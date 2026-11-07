import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as t from "@/lib/db/schema";
import { fixtureDeps } from "@/lib/deps";
import { commitProposal, evaluateGoal, importProjects, reviewClaim, reviewReading, setGoal, MAX_CLAIM_CALLS, type Deps } from "@/lib/workspace";
import { attorneyView, deriveEntrust, portfolioView } from "@/lib/views/project";
import { approveAllAndEvaluate, claimByText, exampleWorkspace, snap } from "./helpers";

const who = { handle: "rin", personName: "Rin Okafor (EXAMPLE)" };
const projectsOf = (profile: { projects: { title: string; role: string; url: string }[] }) =>
  profile.projects.map((p) => ({ title: p.title, role: p.role, urls: [{ url: p.url }] }));

describe("review fixes", () => {
  it("re-import drops evidence whose quote left the source and withdraws what cited it", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    await approveAllAndEvaluate(db, token, workspaceId, profile.goal);
    const claim = claimByText(db, workspaceId, "Built event replay that rebuilds the timeline from a local log");
    const edited: Deps = {
      ...fixtureDeps,
      fetchSources: async (url, own, all, w) =>
        (await fixtureDeps.fetchSources(url, own, all, w)).map((s) =>
          s.locator === "commits" && url.endsWith("tidepool") ? { ...s, text: s.text.replace("c77e019 rin: Replay the event log to rebuild the timeline\n", "") } : s,
        ),
    };
    await importProjects(db, token, projectsOf(profile), edited);
    const after = claimByText(db, workspaceId, claim.text);
    expect(after.revision).toBe(claim.revision + 1);
    expect(after.evidence.some((e) => e.quote.includes("c77e019"))).toBe(false);
    expect(deriveEntrust(snap(db, workspaceId)).withdrawn.length).toBeGreaterThan(0);
  });

  it("owner lines, contributor counts and READMEs that name the person never back authorship", async () => {
    const ctx = await exampleWorkspace();
    const project = snap(ctx.db, ctx.workspaceId).projects.find((p) => p.title === "Kerf")!;
    const sources = ctx.db.select().from(t.sources).where(eq(t.sources.projectId, project.id)).all();
    const contributors = sources.find((s) => s.locator === "contributors")!;
    const readme = sources.find((s) => s.locator === "README.md")!;
    commitProposal(
      ctx.db,
      project.id,
      {
        engine: "model:test",
        questions: [],
        claims: [
          { text: "Built the Kerf deploy engine", kind: "contribution", attribution: "author", tags: [], legalFlag: null, quotes: [{ sourceId: contributors.id, quote: "rin: 3 commits" }] },
          { text: "Leads Kerf", kind: "contribution", attribution: "author", tags: [], legalFlag: null, quotes: [{ sourceId: readme.id, quote: "Maintainers: Contributor C (EXAMPLE), Rin Okafor (EXAMPLE)" }] },
        ],
      },
      sources,
      who,
      Date.now(),
    );
    expect(claimByText(ctx.db, ctx.workspaceId, "Built the Kerf deploy engine").state).toBe("unverified");
    expect(claimByText(ctx.db, ctx.workspaceId, "Leads Kerf").state).toBe("unverified");
  });

  it("raising your own attribution makes the claim rest on your word", async () => {
    const { db, token, workspaceId } = await exampleWorkspace();
    const kerf = claimByText(db, workspaceId, "Co-maintains Kerf, including its release process");
    reviewClaim(db, token, kerf.id, { action: "correct", attribution: "author" });
    expect(claimByText(db, workspaceId, kerf.text).state).toBe("user_attested");
  });

  it("the portfolio drops capabilities whose cited claims are all private, and leaks none of their text", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    await approveAllAndEvaluate(db, token, workspaceId, profile.goal);
    const kerf = claimByText(db, workspaceId, "Co-maintains Kerf, including its release process");
    reviewClaim(db, token, kerf.id, { action: "publishable", publishable: false });
    const portfolio = portfolioView(snap(db, workspaceId));
    expect(portfolio.capabilities.map((c) => c.name)).not.toContain("Own releases and preview deploys");
    expect(JSON.stringify(portfolio)).not.toContain("Co-maintains Kerf");
    expect(attorneyView(snap(db, workspaceId)).capabilities.map((c) => c.name)).toContain("Own releases and preview deploys");
  });

  it("resubmitting the same goal costs no call and keeps rejected readings", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    let calls = 0;
    const counting: Deps = { ...fixtureDeps, inferCapabilities: async (g, c) => (calls++, fixtureDeps.inferCapabilities(g, c)) };
    await approveAllAndEvaluate(db, token, workspaceId, profile.goal, counting);
    const sync = deriveEntrust(snap(db, workspaceId)).capabilities[0]!;
    reviewReading(db, token, sync.key, "reject_reading", "not convinced");
    setGoal(db, token, profile.goal);
    await evaluateGoal(db, token, counting);
    expect(calls).toBe(2);
    expect(deriveEntrust(snap(db, workspaceId)).capabilities.map((c) => c.name)).not.toContain(sync.name);
    setGoal(db, token, profile.goal);
    await evaluateGoal(db, token, counting);
    expect(calls).toBe(2);
  });

  it("a visibility toggle is not counted as a correction", async () => {
    const { db, token, workspaceId } = await exampleWorkspace();
    const c = snap(db, workspaceId).projects[0]!.claims[0]!;
    reviewClaim(db, token, c.id, { action: "approve" });
    reviewClaim(db, token, c.id, { action: "publishable", publishable: false });
    const dossier = attorneyView(snap(db, workspaceId));
    expect(dossier.reviewLog.map((r) => r.action)).toContain("visibility");
    expect(dossier.questions.join(" ")).not.toMatch(/corrected/);
  });

  it("claim calls per project stop at the hard ceiling", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    let calls = 0;
    let n = 0;
    const churn: Deps = {
      ...fixtureDeps,
      fetchSources: async (url, own, all, w) => (await fixtureDeps.fetchSources(url, own, all, w)).map((s) => (s.locator === "README.md" ? { ...s, text: `${s.text}\nfetched ${n++}` } : s)),
      proposeClaims: async (i) => (calls++, fixtureDeps.proposeClaims(i)),
    };
    for (let i = 0; i < MAX_CLAIM_CALLS + 2; i++) await importProjects(db, token, projectsOf(profile).slice(0, 1), churn);
    const project = snap(db, workspaceId).projects[0]!;
    expect(project.claimCalls).toBe(MAX_CLAIM_CALLS);
    expect(calls).toBe(MAX_CLAIM_CALLS - 1);
  });
});
