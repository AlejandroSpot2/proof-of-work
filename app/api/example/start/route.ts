import { getDb } from "@/lib/db/client";
import { ownerCookie } from "@/lib/auth";
import { createWorkspace, importProjects, reviewClaim, setGoal, evaluateGoal } from "@/lib/workspace";
import { loadProfile } from "@/lib/fixtures/rin";
import { loadSnapshot } from "@/lib/views/project";
import { fixtureDeps } from "@/lib/deps";

export const dynamic = "force-dynamic";

/**
 * Rehearsal and inspection shortcut, fixture mode only: a fresh EXAMPLE workspace, optionally carried to a
 * later stage by running the same real steps the guided demo runs (import, confirm, ask). Never touches the network.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const stage = url.searchParams.get("stage") ?? "new";
  const to = url.searchParams.get("to") ?? "/demo";
  const target = to.startsWith("/") && !to.startsWith("//") ? to : "/demo";
  const db = getDb();
  const profile = loadProfile();
  const { workspaceId, token } = createWorkspace(db, { personName: profile.name, githubHandle: profile.handle, mode: "fixture" });
  if (stage === "imported" || stage === "answered") {
    await importProjects(db, token, profile.projects.map((p) => ({ title: p.title, role: p.role, urls: [{ url: p.url }] })), fixtureDeps);
  }
  if (stage === "answered") {
    for (const c of loadSnapshot(db, workspaceId)!.projects.flatMap((p) => p.claims)) {
      if (c.reviewStatus === "proposed" && c.state !== "unverified") reviewClaim(db, token, c.id, { action: "approve" });
    }
    setGoal(db, token, profile.goal);
    await evaluateGoal(db, token, fixtureDeps);
  }
  return new Response(null, { status: 303, headers: { Location: target, "Set-Cookie": ownerCookie(token), "Cache-Control": "no-store" } });
}
