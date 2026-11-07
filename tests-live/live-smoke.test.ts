import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createDb } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { fixtureDeps, liveDeps } from "@/lib/deps";
import { loadProfile } from "@/lib/fixtures/rin";
import { modelStatus } from "@/lib/ai/model";
import { quoteIsLiteral } from "@/lib/domain/rules";
import { createWorkspace, evaluateGoal, importProjects, reviewClaim, setGoal, type Deps, type ImportEvent } from "@/lib/workspace";
import { loadSnapshot } from "@/lib/views/project";

const envFile = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const secret = process.env.ANTHROPIC_API_KEY ?? "";
const sanitize = (m: string) => (secret ? m.replaceAll(secret, "[redacted]") : m).slice(0, 400);

/** Sources come from the EXAMPLE files (no network fetch); claims and capabilities come only from the live model. */
const deps: Deps = { ...liveDeps, fetchSources: fixtureDeps.fetchSources };

describe("live smoke on Rin's EXAMPLE artifacts", () => {
  it("claims and capabilities come from the model and pass every check", async () => {
    const status = modelStatus();
    console.log(`model status: ${status.ready ? `ready (${status.label})` : `not ready: ${status.reason}`}`);
    expect(status.ready).toBe(true);

    const db = createDb(":memory:");
    const profile = loadProfile();
    const { workspaceId, token } = createWorkspace(db, { personName: profile.name, githubHandle: profile.handle, mode: "live" });
    const errors: string[] = [];
    const started = Date.now();
    await importProjects(
      db,
      token,
      profile.projects.map((p) => ({ title: p.title, role: p.role, urls: [{ url: p.url }] })),
      deps,
      (e: ImportEvent) => {
        if (e.type === "error") errors.push(sanitize(e.message));
      },
    );
    if (errors.length) console.log(`import errors:\n${errors.join("\n")}`);
    expect(errors).toEqual([]);

    const snap = loadSnapshot(db, workspaceId)!;
    const sources = db.select().from(t.sources).all();
    const summary: string[] = [];
    for (const p of snap.projects) {
      expect(p.report?.engine).toBe(`model:${status.ready ? status.label : ""}`);
      expect(p.report?.llmCalled).toBe(true);
      summary.push(`\n## ${p.title}: ${p.claims.length} kept, ${p.report!.discarded.length} discarded (quote not literal), ${p.report!.heldBack.length} held back (authorship)`);
      for (const c of p.claims) {
        summary.push(`- [${c.state} · ${c.attribution}] ${c.text}`);
        for (const e of c.evidence) {
          const src = sources.find((s) => s.id === e.sourceId)!;
          expect(quoteIsLiteral(e.quote, src.snippetStore)).toBe(true);
          summary.push(`    “${e.quote}” (${e.locator}, ${e.supportScore})`);
        }
      }
      for (const d of p.report!.discarded) summary.push(`- discarded: ${d.text} (${d.reason})`);
      for (const h of p.report!.heldBack) summary.push(`- held back: ${h.text} (${h.reason})`);
    }

    for (const c of snap.projects.flatMap((p) => p.claims)) {
      if (c.state !== "unverified") reviewClaim(db, token, c.id, { action: "approve" });
    }
    setGoal(db, token, profile.goal);
    let projection;
    try {
      projection = await evaluateGoal(db, token, deps);
    } catch (err) {
      console.log(`capabilities error: ${sanitize((err as Error).message)}`);
      throw err;
    }
    expect(projection.engine).toBe(`model:${status.ready ? status.label : ""}`);
    const approved = new Set(loadSnapshot(db, workspaceId)!.projects.flatMap((p) => p.claims).filter((c) => c.reviewStatus === "approved").map((c) => c.id));
    summary.push(`\n## Capabilities for: ${profile.goal}`);
    for (const c of projection.capabilities) {
      for (const r of c.claimRefs) expect(approved.has(r.claimId)).toBe(true);
      summary.push(`- [${c.support}] ${c.name} (cites ${c.claimRefs.length} approved claims, ${c.evidenceIds.length} quotes)`);
      for (const l of c.limits) summary.push(`    limit: ${l}`);
    }
    for (const d of projection.discarded) summary.push(`- discarded by validation: ${d.name} (${d.reason})`);
    summary.push(`question: ${projection.question ?? "none"}`);
    if (projection.nextBuild) summary.push(`next build: ${projection.nextBuild.title} (${projection.nextBuild.parts.length} parts)`);
    summary.unshift(`# Live smoke, ${new Date().toISOString()}, ${status.ready ? status.label : ""}, ${((Date.now() - started) / 1000).toFixed(0)}s, 4 model calls`);

    const out = summary.join("\n");
    console.log(out);
    fs.mkdirSync(path.join(process.cwd(), "tests-live", "out"), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), "tests-live", "out", "live-smoke.md"), out + "\n");
  });
});
