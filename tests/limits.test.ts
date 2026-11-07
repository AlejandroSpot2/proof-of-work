import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as t from "@/lib/db/schema";
import { commitProposal, approvedLedger } from "@/lib/workspace";
import { validateProposal } from "@/lib/capabilities/validate";
import { approveAllAndEvaluate, claimByText, exampleWorkspace, snap } from "./helpers";

const who = { handle: "rin", personName: "Rin Okafor (EXAMPLE)" };

describe("limits are enforced per item, not by rejecting the whole model answer", () => {
  it("drops an over-long claim with a reason and keeps the rest", async () => {
    const ctx = await exampleWorkspace();
    const project = snap(ctx.db, ctx.workspaceId).projects.find((p) => p.title === "Tidepool")!;
    const sources = ctx.db.select().from(t.sources).where(eq(t.sources.projectId, project.id)).all();
    const commits = sources.find((s) => s.locator === "commits")!;
    const report = commitProposal(
      ctx.db,
      project.id,
      {
        engine: "model:test",
        questions: [],
        claims: [
          { text: "x".repeat(260), kind: "contribution", attribution: "author", tags: [], legalFlag: null, quotes: [{ sourceId: commits.id, quote: "3f1a9c2 rin: Resolve concurrent edits per field with last-writer-wins" }] },
          {
            text: "Stamped every local event with a clock",
            kind: "contribution",
            attribution: "author",
            tags: [],
            legalFlag: null,
            quotes: [
              { sourceId: commits.id, quote: "rin" },
              { sourceId: commits.id, quote: "8b20d41 rin: Stamp every local event with a hybrid logical clock" },
            ],
          },
        ],
      },
      sources,
      who,
      Date.now(),
    );
    expect(report.discarded.map((d) => d.reason)).toEqual(["Its wording is over 200 characters to review as one statement."]);
    const kept = claimByText(ctx.db, ctx.workspaceId, "Stamped every local event with a clock");
    expect(kept.evidence.map((e) => e.quote)).toEqual(["8b20d41 rin: Stamp every local event with a hybrid logical clock"]);
    expect(kept.state).toBe("fetched");
  });

  it("drops an over-long capability name and keeps the valid ones", async () => {
    const { db, token, workspaceId, profile } = await exampleWorkspace();
    await approveAllAndEvaluate(db, token, workspaceId, profile.goal);
    const ledger = approvedLedger(db, workspaceId);
    const v = validateProposal(
      {
        capabilities: [
          { name: "y".repeat(200), support: "demonstrated", claimIds: [ledger[0]!.id], evidenceIds: [], limits: [] },
          { name: "Ship it", support: "demonstrated", claimIds: [ledger[0]!.id], evidenceIds: [], limits: ["z".repeat(400), "short limit"] },
        ],
        gaps: ["", " a gap "],
        question: "  ",
        nextBuild: null,
      },
      ledger,
      { engine: "t", ledgerRevision: 0, now: 0 },
    );
    expect(v.capabilities.map((c) => c.name)).toEqual(["Ship it"]);
    expect(v.discarded[0]!.reason).toMatch(/over 140 characters/);
    expect(v.capabilities[0]!.limits).toContain("short limit");
    expect(v.capabilities[0]!.limits.some((l) => l.length > 300)).toBe(false);
    expect(v.gaps).toEqual(["a gap"]);
    expect(v.question).toBeNull();
  });
});
