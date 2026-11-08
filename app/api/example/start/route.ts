import { getDb } from "@/lib/db/client";
import { ownerCookie, rememberCookie } from "@/lib/auth";
import { createWorkspace, importProjects, reviewClaim, setGoal, evaluateGoal, createPresentation } from "@/lib/workspace";
import { updatePortfolioSettings } from "@/lib/portfolio";
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
  const full = stage === "answered" || stage === "published";
  if (stage === "imported" || full) {
    await importProjects(db, token, profile.projects.map((p) => ({ title: p.title, role: p.role, urls: [{ url: p.url }] })), fixtureDeps);
  }
  if (full) {
    for (const c of loadSnapshot(db, workspaceId)!.projects.flatMap((p) => p.claims)) {
      if (c.reviewStatus === "proposed" && c.state !== "unverified") reviewClaim(db, token, c.id, { action: "approve" });
    }
    setGoal(db, token, profile.goal);
    await evaluateGoal(db, token, fixtureDeps);
    updatePortfolioSettings(db, workspaceId, { builtAt: Date.now() });
  }
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", ownerCookie(token));
  headers.append("Set-Cookie", rememberCookie("fixture", token));
  if (stage === "published") {
    const pres = createPresentation(db, token, "portfolio");
    headers.set("Location", `/p/${pres.token}`);
    return new Response(null, { status: 303, headers });
  }
  headers.set("Location", target);
  return new Response(null, { status: 303, headers });
}
