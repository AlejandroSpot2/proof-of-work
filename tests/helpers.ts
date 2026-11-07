import { createDb, type Db } from "@/lib/db/client";
import { fixtureDeps } from "@/lib/deps";
import { loadProfile } from "@/lib/fixtures/rin";
import { createWorkspace, importProjects, reviewClaim, setGoal, evaluateGoal, type Deps } from "@/lib/workspace";
import { loadSnapshot } from "@/lib/views/project";

export async function exampleWorkspace(deps: Deps = fixtureDeps) {
  const db = createDb(":memory:");
  const profile = loadProfile();
  const { workspaceId, token } = createWorkspace(db, { personName: profile.name, githubHandle: profile.handle, mode: "fixture" });
  await importProjects(
    db,
    token,
    profile.projects.map((p) => ({ title: p.title, role: p.role, urls: [{ url: p.url }] })),
    deps,
  );
  return { db, token, workspaceId, profile, deps };
}

export function snap(db: Db, workspaceId: string) {
  return loadSnapshot(db, workspaceId)!;
}

export function claimByText(db: Db, workspaceId: string, text: string) {
  const c = snap(db, workspaceId).projects.flatMap((p) => p.claims).find((c) => c.text === text);
  if (!c) throw new Error(`no claim "${text}"`);
  return c;
}

export async function approveAllAndEvaluate(db: Db, token: string, workspaceId: string, goal: string, deps: Deps = fixtureDeps) {
  for (const c of snap(db, workspaceId).projects.flatMap((p) => p.claims)) {
    if (c.reviewStatus === "proposed" && c.state !== "unverified") reviewClaim(db, token, c.id, { action: "approve" });
  }
  setGoal(db, token, goal);
  return evaluateGoal(db, token, deps);
}
