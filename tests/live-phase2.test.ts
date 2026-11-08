import { describe, expect, it } from "vitest";
import * as t from "@/lib/db/schema";
import { createDb } from "@/lib/db/client";
import { fixtureDeps } from "@/lib/deps";
import { createWorkspace, importProjects, type Deps } from "@/lib/workspace";
import { buildPortfolio } from "@/lib/portfolio";
import { buildPacket } from "@/lib/packet/model";
import { quoteIsLiteral } from "@/lib/domain/rules";
import { content } from "@/lib/i18n";
import { cachedTranslation, contentStrings, keepsFacts, translatePortfolio } from "@/lib/translate";
import { extractByRules, validateExtraction } from "@/lib/requirements";
import { applyPlan, adaptedIntro, type OfferFixture } from "@/lib/next-paths";
import { approveAllAndEvaluate, exampleWorkspace, liveBuilt, mockedLive } from "./helpers";

const POSTING = `Founding Engineer at Larkspur (a fictional company for this test)

What you will do:
- Build offline sync that merges edits from devices in the field.
- Own the release process and keep a changelog.
- Run the service in production with an on-call rotation.
- Design the billing system and integrate payment providers.`;

const offerOf = (x: Awaited<ReturnType<typeof extractByRules>>): OfferFixture => ({
  id: "pasted",
  company: x.company ?? "",
  role: x.role ?? "",
  location: "",
  retrieved: "2026-11-08",
  requirements: x.requirements.map((r, i) => ({ id: `r${i + 1}`, line: r.line, es: "", short: { en: r.short, es: r.short }, match: r.match })),
});

describe("Live translation", () => {
  it("translates only the portfolio's own words: quotes stay byte-identical and are never sent", async () => {
    const sent: string[] = [];
    const { db, workspaceId, deps } = await liveBuilt();
    const spy: Deps = { ...deps, translate: async (texts, lang) => (sent.push(...texts), deps.translate(texts, lang)) };
    const before = buildPortfolio(db, workspaceId, { audience: "owner" })!;
    const quotes = [...before.projects.flatMap((p) => p.proof), ...before.capabilities.flatMap((c) => c.proof)].map((q) => q.quote);
    expect(quotes.length).toBeGreaterThan(0);
    const tr = await translatePortfolio(db, workspaceId, "es", spy);
    for (const q of quotes) {
      expect(sent).not.toContain(q);
      expect(content(q, "es", false, tr.entries)).toEqual({ text: q, translated: false });
    }
    const after = buildPortfolio(db, workspaceId, { audience: "owner" })!;
    expect([...after.projects.flatMap((p) => p.proof), ...after.capabilities.flatMap((c) => c.proof)].map((q) => q.quote)).toEqual(quotes);
    const sources = db.select().from(t.sources).all();
    for (const q of after.projects.flatMap((p) => p.proof)) expect(quoteIsLiteral(q.quote, sources.find((s) => s.id === q.sourceId)!.snippetStore)).toBe(true);
  });

  it("shows EN and ES on a live workspace, marks every translated text, and never re-bills a cached version", async () => {
    let calls = 0;
    const { db, workspaceId, deps } = await liveBuilt();
    const counting: Deps = { ...deps, translate: async (texts, lang) => (calls++, deps.translate(texts, lang)) };
    const model = buildPortfolio(db, workspaceId, { audience: "owner" })!;
    const tr = await translatePortfolio(db, workspaceId, "es", counting);
    for (const x of contentStrings(model)) {
      expect(content(x, "es", false, tr.entries)).toEqual({ text: `ES ${x}`, translated: true });
      expect(content(x, "en", false, tr.entries)).toEqual({ text: x, translated: false });
    }
    await translatePortfolio(db, workspaceId, "es", counting);
    expect(calls).toBe(1);
    expect(cachedTranslation(db, workspaceId, "es")!.engine).toBe("mock translator");
  });

  it("drops a translation that changes a fact, keeping the original text", () => {
    expect(keepsFacts("Evaluated on 20 synthetic examples, see NOTES.md", "Evaluado con 20 ejemplos sintéticos, ver NOTES.md")).toBe(true);
    expect(keepsFacts("Evaluated on 20 synthetic examples", "Evaluado con 200 ejemplos sintéticos")).toBe(false);
    expect(keepsFacts("See NOTES.md", "Ver las notas")).toBe(false);
  });

  it("has no fallback: a failing model leaves nothing translated and nothing cached", async () => {
    const { db, workspaceId, deps } = await liveBuilt();
    const failing: Deps = { ...deps, translate: async () => Promise.reject(new Error("ANTHROPIC_API_KEY is not set.")) };
    await expect(translatePortfolio(db, workspaceId, "es", failing)).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(cachedTranslation(db, workspaceId, "es")).toBeNull();
    const model = buildPortfolio(db, workspaceId, { audience: "owner" })!;
    for (const x of contentStrings(model)) expect(content(x, "es", false, null).translated).toBe(false);
  });
});

describe("Live Apply for a role", () => {
  it("keeps only lines that are literally in the posting, and match words from those lines", () => {
    const read = validateExtraction(
      POSTING,
      {
        role: "Founding Engineer",
        company: "Larkspur",
        requirements: [
          { line: "Build offline sync that merges edits from devices in the field.", short: "offline sync", match: ["offline", "sync", "kubernetes"] },
          { line: "10 years of Rust in production at a FAANG company.", short: "Rust", match: ["rust"] },
        ],
      },
      "mock model",
    );
    expect(read.requirements.map((r) => r.line)).toEqual(["Build offline sync that merges edits from devices in the field."]);
    expect(read.requirements[0]!.match).toEqual(["offline", "sync"]);
    expect(read.role).toBe("Founding Engineer");
    expect(validateExtraction(POSTING, { role: "Staff Engineer", company: "Acme", requirements: [] }, "m").company).toBeNull();
  });

  it("never shows a gap as backed: backing needs the real ledger's proof, unknown and unmatched are gaps", async () => {
    const { db, workspaceId } = await liveBuilt();
    const model = buildPortfolio(db, workspaceId, { audience: "owner" })!;
    const read = await extractByRules(POSTING);
    const plan = applyPlan(model, offerOf(read));
    const status = Object.fromEntries(plan.requirements.map((r) => [r.line, r.status]));
    const sync = status["Build offline sync that merges edits from devices in the field."]!;
    const release = status["Own the release process and keep a changelog."]!;
    const production = status["Run the service in production with an on-call rotation."]!;
    const billing = status["Design the billing system and integrate payment providers."]!;
    expect(sync.kind).toBe("backed");
    expect(release.kind).toBe("backed");
    expect(production).toEqual({ kind: "gap", reason: { kind: "not-shown", capability: "Run it in production for real users", limit: "No file shows real users." } });
    expect(billing).toEqual({ kind: "gap", reason: { kind: "nothing" } });
    const sources = db.select().from(t.sources).all();
    for (const r of plan.requirements) {
      if (r.status.kind !== "backed") continue;
      for (const q of r.status.backing.flatMap((b) => b.proof)) expect(quoteIsLiteral(q.quote, sources.find((s) => s.id === q.sourceId)!.snippetStore)).toBe(true);
    }
    const intro = adaptedIntro(plan, model, "en");
    expect(intro).toMatch(/Ada's files back 2 of the \d+ requirements/);
    expect(intro.split(/(?<=\.)\s/)[0]).not.toMatch(/production|billing/i);
  });

  it("uses only approved statements: unapproved work backs nothing", async () => {
    const deps = mockedLive();
    const db = createDb(":memory:");
    const { workspaceId, token } = createWorkspace(db, { personName: "Ada Test", githubHandle: "ada", mode: "live" });
    await importProjects(db, token, [{ title: "Gizmo", role: "Author", urls: [{ url: "https://github.com/ada/gizmo" }] }], deps);
    const model = buildPortfolio(db, workspaceId, { audience: "owner" })!;
    const plan = applyPlan(model, offerOf(await extractByRules(POSTING)));
    expect(plan.requirements.every((r) => r.status.kind === "gap")).toBe(true);
  });

  it("has no fallback: a failing reader returns an error, never the EXAMPLE offer", async () => {
    const failing: Deps = mockedLive({ extractRequirements: async () => Promise.reject(new Error("ANTHROPIC_API_KEY is not set.")) });
    await expect(failing.extractRequirements(POSTING)).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(validateExtraction(POSTING, { requirements: [{ line: "You have built offline-first sync for an app people use without signal." }] }, "m").requirements).toEqual([]);
  });
});

describe("Demo stays offline and unchanged", () => {
  it("translates the EXAMPLE with the prepared dictionary and leaves unknown text untranslated", async () => {
    const ctx = await exampleWorkspace();
    await approveAllAndEvaluate(ctx.db, ctx.token, ctx.workspaceId, ctx.profile.goal);
    const res = await fixtureDeps.translate(["Offline field-notes app with AI tagging", "Something nobody prepared"], "es");
    expect(res.translations).toEqual(["App de notas de campo offline con etiquetado por IA", ""]);
    const read = await fixtureDeps.extractRequirements(POSTING);
    expect(read.engine).toBe("line rules (no model)");
  });
});

describe("The live kit before a build", () => {
  it("has no statements, so the screen shows an empty state instead of a zero summary", async () => {
    const db = createDb(":memory:");
    const { workspaceId } = createWorkspace(db, { personName: "Ada Test", githubHandle: "ada", mode: "live" });
    const packet = buildPacket(db, workspaceId)!;
    expect(packet.example).toBe(false);
    expect(packet.summary.statements).toBe(0);
  });
});
