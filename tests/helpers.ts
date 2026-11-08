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

const COMMITS = [
  "a1b2c3d ada: Merge per-field edits when devices reconnect (2025-01-02)",
  "d4e5f6a ada: Keep every edit in a local log first (2025-01-09)",
  "f7a8b9c ada: Cut the release with a generated changelog (2025-02-03)",
].join("\n");

/** A real (live) workspace with no network and no model: GitHub-like commits, and mocked model answers. */
export function mockedLive(over: Partial<Deps> = {}): Deps {
  return {
    ...fixtureDeps,
    async fetchSources(url) {
      return [{ url, kind: "github", status: "ok", statusDetail: "", locator: "commits by @ada", text: COMMITS, authorship: "all-by-handle" }];
    },
    async proposeClaims({ sources }) {
      const id = sources[0]!.id;
      return {
        engine: "mock model",
        questions: [],
        claims: [
          { text: "Built per-field merging of edits for devices that reconnect", kind: "contribution", attribution: "author", tags: ["sync"], legalFlag: null, quotes: [{ sourceId: id, quote: "Merge per-field edits when devices reconnect" }] },
          { text: "Cut releases with a generated changelog", kind: "contribution", attribution: "author", tags: ["releases"], legalFlag: null, quotes: [{ sourceId: id, quote: "Cut the release with a generated changelog" }] },
        ],
      };
    },
    async inferCapabilities(_goal, claims) {
      const sync = claims.find((c) => /merging/.test(c.text))!;
      const rel = claims.find((c) => /releases/.test(c.text))!;
      return {
        engine: "mock model",
        proposal: {
          capabilities: [
            { name: "Build offline sync that merges conflicting edits", support: "demonstrated", claimIds: [sync.id], evidenceIds: sync.evidence.map((e) => e.id), limits: [] },
            { name: "Run the release process with a changelog", support: "demonstrated", claimIds: [rel.id], evidenceIds: rel.evidence.map((e) => e.id), limits: [] },
            { name: "Run it in production for real users", support: "unknown", claimIds: [], evidenceIds: [], limits: ["No file shows real users."] },
          ],
          gaps: ["Production use is not shown."],
          question: "Has this run with real users?",
          nextBuild: null,
        },
      };
    },
    async translate(texts) {
      return { translations: texts.map((x) => `ES ${x}`), engine: "mock translator" };
    },
    ...over,
  };
}

export async function liveBuilt(deps: Deps = mockedLive(), db: Db = createDb(":memory:")) {
  const { workspaceId, token } = createWorkspace(db, { personName: "Ada Test", githubHandle: "ada", mode: "live" });
  await importProjects(db, token, [{ title: "Gizmo", role: "Author", urls: [{ url: "https://github.com/ada/gizmo" }] }], deps);
  for (const c of loadSnapshot(db, workspaceId)!.projects.flatMap((p) => p.claims)) reviewClaim(db, token, c.id, { action: "approve" });
  setGoal(db, token, "Founding engineer");
  await evaluateGoal(db, token, deps);
  return { db, workspaceId, token, deps };
}
