import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fixtureDeps } from "@/lib/deps";
import { commitProposal, evaluateGoal, importProjects, reviewClaim, createPresentation, resolvePresentation, revokePresentation, ownerWorkspace, OwnerError, setGoal, attestClaim } from "@/lib/workspace";
import { attorneyView, deriveEntrust, portfolioView, NO_ELIGIBILITY } from "@/lib/views/project";
import { quoteIsLiteral } from "@/lib/domain/rules";
import * as t from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Deps } from "@/lib/workspace";
import { approveAllAndEvaluate, claimByText, exampleWorkspace, snap } from "./helpers";

const expected = JSON.parse(fs.readFileSync(path.join(process.cwd(), "fixtures/example-rin/expected.json"), "utf8"));

const capSupports = (caps: { name: string; support: string }[]) => Object.fromEntries(caps.map((c) => [c.name, c.support]));

describe("import and quote traceability", () => {
  it("imports 3 projects, each with at most 5 sources, all ok", async () => {
    const { db, workspaceId } = await exampleWorkspace();
    const s = snap(db, workspaceId);
    expect(s.projects.map((p) => p.title)).toEqual(["Tidepool", "Quietroom", "Kerf"]);
    for (const p of s.projects) {
      expect(p.sources.length).toBeLessThanOrEqual(5);
      expect(p.sources.every((src) => src.status === "ok")).toBe(true);
    }
  });

  it("every shown claim has evidence whose quote is literally in its source, or is user_attested/unverified", async () => {
    const { db, workspaceId } = await exampleWorkspace();
    const sources = db.select().from(t.sources).all();
    const claims = snap(db, workspaceId).projects.flatMap((p) => p.claims);
    expect(claims.length).toBeGreaterThan(0);
    for (const c of claims) {
      if (c.state === "user_attested" || c.state === "unverified") continue;
      expect(c.evidence.length).toBeGreaterThan(0);
      for (const e of c.evidence) {
        const src = sources.find((x) => x.id === e.sourceId)!;
        expect(quoteIsLiteral(e.quote, src.snippetStore)).toBe(true);
      }
    }
  });

  it("discards a proposed claim whose quote is not in the source", async () => {
    const { db, workspaceId, token } = await exampleWorkspace();
    const project = snap(db, workspaceId).projects[0]!;
    const sources = db.select().from(t.sources).where(eq(t.sources.projectId, project.id)).all();
    const report = commitProposal(
      db,
      project.id,
      {
        engine: "model:test",
        questions: [],
        claims: [{ text: "Scaled Tidepool to a million users", kind: "impact", attribution: "author", tags: [], legalFlag: null, quotes: [{ sourceId: sources[0]!.id, quote: "Tidepool serves a million daily users." }] }],
      },
      sources,
      { handle: "rin", personName: "Rin Okafor (EXAMPLE)" },
      Date.now(),
    );
    expect(report.discarded.map((d) => d.text)).toEqual(["Scaled Tidepool to a million users"]);
    expect(snap(db, workspaceId).projects[0]!.claims.some((c) => c.text.includes("million"))).toBe(false);
    void token;
  });

  it("matches the expected claim states from the fixture", async () => {
    const { db, workspaceId } = await exampleWorkspace();
    for (const [text, state] of Object.entries(expected.beforeCorrection.claimStates)) {
      expect(claimByText(db, workspaceId, text).state).toBe(state);
    }
  });
});

describe("attribution", () => {
  const who = { handle: "rin", personName: "Rin Okafor (EXAMPLE)" };
  async function propose(projectTitle: string, claim: { text: string; quoteSource: string; quote: string; attribution?: "author" | "co_author" }) {
    const ctx = await exampleWorkspace();
    const project = snap(ctx.db, ctx.workspaceId).projects.find((p) => p.title === projectTitle)!;
    const sources = ctx.db.select().from(t.sources).where(eq(t.sources.projectId, project.id)).all();
    const src = sources.find((s) => s.url.endsWith(claim.quoteSource))!;
    const report = commitProposal(
      ctx.db,
      project.id,
      { engine: "model:test", questions: [], claims: [{ text: claim.text, kind: "contribution", attribution: claim.attribution ?? "author", tags: ["deployment"], legalFlag: null, quotes: [{ sourceId: src.id, quote: claim.quote }] }] },
      sources,
      who,
      Date.now(),
    );
    return { report, claim: claimByText(ctx.db, ctx.workspaceId, claim.text) };
  }

  it("Kerf: the README naming her a maintainer never yields 'built Kerf' as fetched authorship", async () => {
    const { report, claim } = await propose("Kerf", { text: "Built Kerf", quoteSource: "kerf/README.md", quote: "A CLI that creates a preview deploy for every pull request and tears it down on merge." });
    expect(claim.state).toBe("unverified");
    expect(claim.attribution).toBe("unknown");
    expect(report.heldBack[0]!.reason).toMatch(/not authorship/);
  });

  it("Kerf: a commit by another contributor never backs her authorship of the deploy engine", async () => {
    const { claim } = await propose("Kerf", { text: "Built Kerf's preview environments", quoteSource: "kerf/commits", quote: "0e7f3a1 contributor-c: Create a preview environment per pull request" });
    expect(claim.state).toBe("unverified");
  });

  it("Tidepool: the storage adapter by Contributor B is not attributed to Rin", async () => {
    const { claim } = await propose("Tidepool", { text: "Built Tidepool's storage adapter", quoteSource: "tidepool/commits", quote: "1d9e3aa contributor-b: Add IndexedDB storage adapter" });
    expect(claim.state).toBe("unverified");
    expect(claim.attribution).toBe("unknown");
  });

  it("a repository where the person has no commits never yields a fetched authorship claim", async () => {
    const ctx = await exampleWorkspace();
    const project = snap(ctx.db, ctx.workspaceId).projects[0]!;
    const sources = ctx.db.select().from(t.sources).where(eq(t.sources.projectId, project.id)).all();
    const foreign = sources.map((s) => ({ ...s, meta: s.meta && { ...s.meta, handleCommitCount: 0 } }));
    const readme = foreign.find((s) => s.locator === "README.md")!;
    commitProposal(
      ctx.db,
      project.id,
      { engine: "model:test", questions: [], claims: [{ text: "Wrote Tidepool", kind: "contribution", attribution: "author", tags: [], legalFlag: null, quotes: [{ sourceId: readme.id, quote: "Offline-first sync for small field teams." }] }] },
      foreign,
      { handle: "rin", personName: "Rin Okafor (EXAMPLE)" },
      Date.now(),
    );
    expect(claimByText(ctx.db, ctx.workspaceId, "Wrote Tidepool").state).not.toMatch(/fetched|corroborated/);
  });
});

describe("entrust question", () => {
  it("answers the fixture goal with demonstrated / unknown capabilities, clickable evidence and at most 1 question", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    const projection = await approveAllAndEvaluate(db, token, workspaceId, profile.goal);
    expect(projection.capabilities.length).toBeLessThanOrEqual(3);
    expect(capSupports(projection.capabilities)).toEqual(expected.beforeCorrection.capabilities);
    const entrust = deriveEntrust(snap(db, workspaceId));
    const demonstrated = entrust.capabilities.find((c) => c.support === "demonstrated")!;
    expect(demonstrated.evidence.length).toBeGreaterThan(0);
    expect(demonstrated.evidence.every((e) => e.sourceUrl.startsWith("example://"))).toBe(true);
    expect(typeof entrust.question).toBe("string");
  });

  it("weak evidence (a described practice only) is at most inferred, with a limit", async () => {
    const { db, token, workspaceId } = await exampleWorkspace();
    const projection = await approveAllAndEvaluate(db, token, workspaceId, "Own product prioritization for our AI tagging roadmap");
    const parts = projection.nextBuild?.parts ?? [];
    void parts;
    const all = [...projection.capabilities];
    const ai = all.find((c) => c.name.startsWith("Build AI features"))!;
    expect(ai.support).toBe("demonstrated");
    const { inferWithFixtureRules } = await import("@/lib/capabilities/fixture-engine");
    const { validateProposal } = await import("@/lib/capabilities/validate");
    const { approvedLedger } = await import("@/lib/workspace");
    const ledger = approvedLedger(db, workspaceId);
    const skill = ledger.find((c) => c.kind === "skill")!;
    const v = validateProposal(
      { capabilities: [{ name: "Prioritize a product roadmap", support: "demonstrated", claimIds: [skill.id], evidenceIds: [], limits: [] }], gaps: [], question: null, nextBuild: null },
      ledger,
      { engine: "test", ledgerRevision: 0, now: 0 },
    );
    expect(v.capabilities[0]!.support).toBe("inferred");
    expect(v.capabilities[0]!.limits.join(" ")).toMatch(/not a shipped result|cannot carry demonstrated/);
    void inferWithFixtureRules;
  });

  it("language-only evidence is at most inferred, with the language limit", async () => {
    const { validateProposal } = await import("@/lib/capabilities/validate");
    const ledger = [
      { id: "c1", projectId: "p", projectTitle: "P", text: "Writes Kotlin", kind: "skill" as const, state: "fetched" as const, attribution: "author" as const, attributionNote: null, revision: 1, tags: [], publishable: true, legalFlag: null, evidence: [{ id: "e1", sourceId: "s", quote: "Kotlin: 48.2% of bytes", locator: "languages", supportScore: "direct" as const, sourceUrl: "" }] },
    ];
    const v = validateProposal({ capabilities: [{ name: "Build Android apps", support: "demonstrated", claimIds: ["c1"], evidenceIds: ["e1"], limits: [] }], gaps: [], question: null, nextBuild: null }, ledger, { engine: "t", ledgerRevision: 0, now: 0 });
    expect(v.capabilities[0]!.support).toBe("inferred");
    expect(v.capabilities[0]!.limits.join(" ")).toMatch(/language in a repo is not mastery/);
  });

  it("an unsupported goal yields no invented capability, only unknown and one question", async () => {
    const { db, token, workspaceId } = await exampleWorkspace();
    const projection = await approveAllAndEvaluate(db, token, workspaceId, "Lead our FPGA firmware team");
    expect(projection.capabilities.filter((c) => c.support !== "unknown")).toEqual([]);
    expect(projection.question).toBeTruthy();
  });

  it("discards a capability that cites a nonexistent or unapproved claim", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    const unapproved = snap(db, workspaceId).projects[0]!.claims[0]!;
    const deps: Deps = {
      ...fixtureDeps,
      inferCapabilities: async () => ({
        engine: "model:test",
        proposal: {
          capabilities: [
            { name: "Invented", support: "demonstrated", claimIds: ["clm_doesnotexist"], evidenceIds: [], limits: [] },
            { name: "Unapproved", support: "demonstrated", claimIds: [unapproved.id], evidenceIds: [], limits: [] },
          ],
          gaps: [],
          question: null,
          nextBuild: null,
        },
      }),
    };
    setGoal(db, token, profile.goal);
    const projection = await evaluateGoal(db, token, deps);
    expect(projection.capabilities).toEqual([]);
    expect(projection.discarded.map((d) => d.name)).toEqual(["Invented", "Unapproved"]);
  });

  it("'what next' links Tidepool sync and Quietroom AI, with prioritization only inferred", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    await approveAllAndEvaluate(db, token, workspaceId, profile.goal);
    const next = deriveEntrust(snap(db, workspaceId)).nextBuild!;
    const projects = new Set(next.parts.flatMap((p) => p.claims.map((c) => c.projectTitle)));
    expect(projects).toEqual(new Set(["Tidepool", "Quietroom"]));
    expect(next.parts.find((p) => p.name.startsWith("Triage"))!.support).toBe("inferred");
    expect(next.parts.every((p) => p.evidence.length > 0)).toBe(true);
    expect(next.gaps.join(" ")).toMatch(/synthetic/);
  });

  it("'what next' proposal only cites approved evidence", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    const kerf = claimByText(db, workspaceId, "Co-maintains Kerf, including its release process");
    reviewClaim(db, token, kerf.id, { action: "reject" });
    await approveAllAndEvaluate(db, token, workspaceId, profile.goal);
    const entrust = deriveEntrust(snap(db, workspaceId));
    const approved = new Set(snap(db, workspaceId).projects.flatMap((p) => p.claims).filter((c) => c.reviewStatus === "approved").map((c) => c.id));
    expect(entrust.nextBuild?.parts.length).toBeGreaterThanOrEqual(2);
    for (const part of entrust.nextBuild!.parts) {
      expect(part.claims.length).toBeGreaterThan(0);
      for (const c of part.claims) expect(approved.has(c.id)).toBe(true);
    }
  });
});

describe("propagation", () => {
  it("the Kerf correction changes both views identically and removes the obsolete capability", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    await approveAllAndEvaluate(db, token, workspaceId, profile.goal);
    const before = portfolioView(snap(db, workspaceId));
    expect(before.capabilities.map((c) => c.name)).toContain("Own the release and deploy process");

    const kerf = claimByText(db, workspaceId, expected.kerfCorrection.claim);
    reviewClaim(db, token, kerf.id, { action: "correct", text: expected.kerfCorrection.text, attribution: expected.kerfCorrection.attribution, attributionNote: expected.kerfCorrection.note });

    const s = snap(db, workspaceId);
    const portfolio = portfolioView(s);
    const dossier = attorneyView(s);
    expect(portfolio.capabilities.map((c) => c.name)).not.toContain("Own the release and deploy process");
    expect(portfolio.capabilities.map((c) => c.key)).toEqual(dossier.capabilities.map((c) => c.key));
    expect(dossier.withdrawn.map((w) => w.name)).toContain("Own the release and deploy process");

    const re = await evaluateGoal(db, token, fixtureDeps);
    expect(capSupports(re.capabilities)).toEqual(expected.afterCorrection.capabilities);
    const after = snap(db, workspaceId);
    expect(capSupports(portfolioView(after).capabilities)).toEqual(capSupports(attorneyView(after).capabilities));
    expect(claimByText(db, workspaceId, expected.kerfCorrection.text).state).toBe("user_attested");
    expect(attorneyView(after).reviewLog.some((r) => r.action === "correct")).toBe(true);
  });
});

describe("regeneration and budgets", () => {
  it("re-import is idempotent and keeps human reviews", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    const kerf = claimByText(db, workspaceId, expected.kerfCorrection.claim);
    reviewClaim(db, token, kerf.id, { action: "correct", text: expected.kerfCorrection.text, attribution: "contributor" });
    const sourcesBefore = db.select().from(t.sources).all().map((s) => s.id).sort();
    const calls: string[] = [];
    const counting: Deps = { ...fixtureDeps, proposeClaims: async (i) => (calls.push(i.projectTitle), fixtureDeps.proposeClaims(i)) };
    await importProjects(db, token, profile.projects.map((p) => ({ title: p.title, role: p.role, urls: [{ url: p.url }] })), counting);
    expect(calls).toEqual([]);
    expect(db.select().from(t.sources).all().map((s) => s.id).sort()).toEqual(sourcesBefore);
    const corrected = claimByText(db, workspaceId, expected.kerfCorrection.text);
    expect(corrected.revision).toBe(2);

    const kerfProject = snap(db, workspaceId).projects.find((p) => p.title === "Kerf")!;
    db.update(t.projects).set({ claimInputHash: "force-regeneration" }).where(eq(t.projects.id, kerfProject.id)).run();
    await importProjects(db, token, profile.projects.map((p) => ({ title: p.title, role: p.role, urls: [{ url: p.url }] })), counting);
    expect(calls).toEqual(["Kerf"]);
    const stillCorrected = claimByText(db, workspaceId, expected.kerfCorrection.text);
    expect(stillCorrected.revision).toBe(2);
    expect(stillCorrected.humanReviewed).toBe(true);
  });

  it("asking the same goal twice with an unchanged ledger makes one inference call", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    let calls = 0;
    const counting: Deps = { ...fixtureDeps, inferCapabilities: async (g, c) => (calls++, fixtureDeps.inferCapabilities(g, c)) };
    await approveAllAndEvaluate(db, token, workspaceId, profile.goal, counting);
    await evaluateGoal(db, token, counting);
    expect(calls).toBe(1);
  });

  it("a 404 or timeout source is unavailable and the rest continue", async () => {
    const deps: Deps = {
      ...fixtureDeps,
      fetchSources: async (url, own, all, who) =>
        url.endsWith("quietroom")
          ? [{ url, kind: "web", status: "unavailable", statusDetail: "HTTP 404", locator: "page", text: "" }]
          : fixtureDeps.fetchSources(url, own, all, who),
    };
    const { db, workspaceId } = await exampleWorkspace(deps);
    const s = snap(db, workspaceId);
    expect(s.projects.find((p) => p.title === "Quietroom")!.sources[0]!.status).toBe("unavailable");
    expect(s.projects.find((p) => p.title === "Kerf")!.claims.length).toBeGreaterThan(0);
  });
});

describe("privacy", () => {
  it("no session, no edit", async () => {
    const { db, workspaceId } = await exampleWorkspace();
    const c = snap(db, workspaceId).projects[0]!.claims[0]!;
    expect(() => reviewClaim(db, null, c.id, { action: "approve" })).toThrow(OwnerError);
    expect(() => reviewClaim(db, "not-a-real-session-token", c.id, { action: "approve" })).toThrow(OwnerError);
    expect(() => setGoal(db, null, "x")).toThrow(OwnerError);
    expect(() => attestClaim(db, null, "prj_x", "x")).toThrow(OwnerError);
    expect(ownerWorkspace(db, null)).toBeNull();
  });

  it("one workspace's session cannot edit another workspace's claims", async () => {
    const a = await exampleWorkspace();
    const { createWorkspace } = await import("@/lib/workspace");
    const other = createWorkspace(a.db, { personName: "Other", githubHandle: "other", mode: "fixture" });
    const c = snap(a.db, a.workspaceId).projects[0]!.claims[0]!;
    expect(() => reviewClaim(a.db, other.token, c.id, { action: "approve" })).toThrow(OwnerError);
  });

  it("a token reads only its own presentation, portfolio never opens the dossier, revoke cuts access", async () => {
    const { db, token } = await exampleWorkspace();
    const portfolio = createPresentation(db, token, "portfolio");
    const dossier = createPresentation(db, token, "attorney");
    expect(resolvePresentation(db, portfolio.token)!.audience).toBe("portfolio");
    expect(resolvePresentation(db, dossier.token)!.audience).toBe("attorney");
    expect(resolvePresentation(db, "x".repeat(32))).toBeNull();
    const stored = db.select().from(t.presentations).all();
    expect(stored.some((p) => p.tokenHash === portfolio.token)).toBe(false);
    revokePresentation(db, token, portfolio.id);
    expect(resolvePresentation(db, portfolio.token)).toBeNull();
    expect(resolvePresentation(db, dossier.token)).not.toBeNull();
  });

  it("the portfolio view carries no legal flags, review log or unpublishable claims", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    await approveAllAndEvaluate(db, token, workspaceId, profile.goal);
    const c = claimByText(db, workspaceId, "Wrote Kerf's getting-started guide and release checklist");
    reviewClaim(db, token, c.id, { action: "publishable", publishable: false });
    const json = JSON.stringify(portfolioView(snap(db, workspaceId)));
    expect(json).not.toContain("getting-started guide");
    expect(json).not.toContain("legalFlag");
    expect(json).not.toContain("reviewLog");
    expect(JSON.stringify(attorneyView(snap(db, workspaceId)))).toContain("getting-started guide");
  });

  it("the dossier states no eligibility assessment and uses no eligibility language", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    await approveAllAndEvaluate(db, token, workspaceId, profile.goal);
    const dossier = attorneyView(snap(db, workspaceId));
    expect(dossier.disclaimer).toBe(NO_ELIGIBILITY);
    const { disclaimer: _d, ...rest } = dossier;
    const text = JSON.stringify(rest).toLowerCase();
    for (const banned of ["eligible", "qualif", "approval odds", "likely to be approved", "o-1", "h-1b", "extraordinary ability"]) {
      expect(text).not.toContain(banned);
    }
  });
});

describe("source budget", () => {
  it("keeps a slot for every URL the user typed, so a blocked page is shown", async () => {
    const { fitBudget } = await import("@/lib/workspace");
    const src = (url: string, locator: string) => ({ url, locator, kind: "github" as const, status: "ok" as const, statusDetail: "", text: "x" });
    const gh = ["repository", "README", "languages", "contributors", "commits"].map((l) => src("https://github.com/o/r", l));
    const blocked = { ...src("http://169.254.169.254/", "page"), status: "blocked" as const };
    const { kept, skipped } = fitBudget([gh, [blocked]], 5);
    expect(kept).toHaveLength(5);
    expect(kept).toContain(blocked);
    expect(skipped.map((s) => s.locator)).toEqual(["commits"]);
  });
});
