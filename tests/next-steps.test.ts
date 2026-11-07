import { describe, expect, it } from "vitest";
import { nextStepsFor } from "@/lib/next-steps";
import { opportunitiesFor } from "@/lib/opportunities";
import { attorneyView, deriveEntrust } from "@/lib/views/project";
import { approveAllAndEvaluate, exampleWorkspace, snap } from "./helpers";

async function steps() {
  const { db, token, workspaceId, profile } = await exampleWorkspace();
  await approveAllAndEvaluate(db, token, workspaceId, profile.goal);
  const s = snap(db, workspaceId);
  const entrust = deriveEntrust(s);
  const approvedEvidence = new Set(s.projects.flatMap((p) => p.claims.filter((c) => c.reviewStatus === "approved").flatMap((c) => c.evidence.map((e) => e.id))));
  return { list: nextStepsFor(entrust, opportunitiesFor(entrust), attorneyView(s).questions.length, "Rin"), approvedEvidence };
}

describe("next steps for an international builder", () => {
  it("builds the MVP, the gap, a sponsoring role and the consult, in that order", async () => {
    const { list } = await steps();
    expect(list.map((s) => s.key)).toEqual(["build", "gap", "role", "consult"]);
  });

  it("cites only approved evidence", async () => {
    const { list, approvedEvidence } = await steps();
    const cited = list.flatMap((s) => s.evidence.map((e) => e.id));
    expect(cited.length).toBeGreaterThan(0);
    for (const id of cited) expect(approvedEvidence.has(id)).toBe(true);
  });

  it("only points at a role whose current posting states sponsorship, with its caveat", async () => {
    const { list } = await steps();
    const role = list.find((s) => s.key === "role")!;
    expect(role.title).toContain("Fieldmark (EXAMPLE)");
    expect(role.caveat).toMatch(/not every visa type/);
    expect(role.caveat).toMatch(/Not a job offer or a visa outcome/);
  });

  it("promises nothing", async () => {
    const { list } = await steps();
    const text = JSON.stringify(list).toLowerCase();
    for (const banned of ["eligible", "will be hired", "guaranteed", "approval odds", "likely to be approved"]) expect(text).not.toContain(banned);
  });
});
