import { describe, expect, it } from "vitest";
import * as t from "@/lib/db/schema";
import { buildPortfolio, updatePortfolioSettings } from "@/lib/portfolio";
import { quoteIsLiteral } from "@/lib/domain/rules";
import { reviewClaim } from "@/lib/workspace";
import { approveAllAndEvaluate, claimByText, exampleWorkspace } from "./helpers";

async function built() {
  const ctx = await exampleWorkspace();
  await approveAllAndEvaluate(ctx.db, ctx.token, ctx.workspaceId, ctx.profile.goal);
  return ctx;
}

describe("portfolio model", () => {
  it("keeps others' work theirs: Kerf's deploy engine is Contributor C's, Tidepool's adapter is Contributor B's", async () => {
    const { db, workspaceId } = await built();
    const m = buildPortfolio(db, workspaceId, { audience: "public" })!;
    const kerf = m.projects.find((p) => p.slug === "kerf")!;
    expect(kerf.others.map((o) => o.who)).toEqual(["contributor-c"]);
    expect(kerf.contribution).toMatch(/contributor-c wrote 4 changes here/);
    expect(kerf.rinPart.some((r) => /deploy engine|infrastructure/i.test(r.text))).toBe(false);
    const tidepool = m.projects.find((p) => p.slug === "tidepool")!;
    expect(tidepool.others[0]!.commits.map((c) => c.message)).toContain("Add IndexedDB storage adapter");
    expect(tidepool.rinPart.some((r) => /storage adapter/i.test(r.text))).toBe(false);
  });

  it("shows only confirmed statements, and every proof quote is literal in its file", async () => {
    const { db, workspaceId } = await built();
    const m = buildPortfolio(db, workspaceId, { audience: "public" })!;
    const sources = db.select().from(t.sources).all();
    const proof = [...m.projects.flatMap((p) => p.proof), ...m.capabilities.flatMap((c) => c.proof)];
    expect(proof.length).toBeGreaterThan(0);
    for (const q of proof) expect(quoteIsLiteral(q.quote, sources.find((s) => s.id === q.sourceId)!.snippetStore)).toBe(true);
  });

  it("keeps private statements and hidden projects out of the public view", async () => {
    const { db, token, workspaceId } = await built();
    const guide = claimByText(db, workspaceId, "Wrote Kerf's getting-started guide and release checklist");
    reviewClaim(db, token, guide.id, { action: "publishable", publishable: false });
    updatePortfolioSettings(db, workspaceId, { hidden: ["quietroom"], headline: "  Edited headline  " });
    const pub = buildPortfolio(db, workspaceId, { audience: "public" })!;
    expect(JSON.stringify(pub)).not.toContain("getting-started guide and release checklist");
    expect(pub.projects.map((p) => p.slug)).toEqual(["tidepool", "kerf"]);
    expect(pub.person.headline).toBe("Edited headline");
    const owner = buildPortfolio(db, workspaceId, { audience: "owner" })!;
    expect(owner.projects.map((p) => p.slug)).toEqual(["tidepool", "quietroom", "kerf"]);
  });

  it("dates each project from its own commit history", async () => {
    const { db, workspaceId } = await built();
    const m = buildPortfolio(db, workspaceId, { audience: "public" })!;
    expect(m.projects.find((p) => p.slug === "tidepool")!.period).toBe("Feb 2025 – May 2025");
  });

  it("an unconfirmed or rejected statement never reaches the portfolio", async () => {
    const { db, token, workspaceId } = await exampleWorkspace();
    const c = claimByText(db, workspaceId, "Found and fixed a prompt-injection hole in feedback ingestion");
    reviewClaim(db, token, c.id, { action: "reject" });
    const m = buildPortfolio(db, workspaceId, { audience: "owner" })!;
    expect(JSON.stringify(m.projects)).not.toContain("prompt-injection hole");
  });
});
