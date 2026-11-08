import { afterEach, describe, expect, it, vi } from "vitest";
import * as t from "@/lib/db/schema";
import { createDb } from "@/lib/db/client";
import { createWorkspace, importProjects, reviewClaim, type Deps, type ImportEvent } from "@/lib/workspace";
import { loadSnapshot } from "@/lib/views/project";
import { buildPortfolio } from "@/lib/portfolio";
import { buildPacket } from "@/lib/packet/model";
import { renderPacketBody, noticeFor, LIVE_NOTICE } from "@/components/packet/document";
import { pdfFilename, PDF_FILENAME } from "@/lib/packet/pdf";
import { liveReadiness } from "@/lib/readiness";
import { fixtureDeps } from "@/lib/deps";
import { approveAllAndEvaluate, exampleWorkspace } from "./helpers";

const COMMITS = "a1b2c3d ada: Merge per-field edits when devices reconnect (2025-01-02)\nd4e5f6a ada: Keep every edit in a local log first (2025-01-09)";

/** A real workspace's dependencies with no network: one GitHub-like source, and a model that either answers or fails. */
function liveDeps(propose: Deps["proposeClaims"]): Deps {
  return {
    ...fixtureDeps,
    async fetchSources(url) {
      return [{ url, kind: "github", status: "ok", statusDetail: "", locator: "commits by @ada", text: COMMITS, authorship: "all-by-handle" }];
    },
    proposeClaims: propose,
    async inferCapabilities() {
      throw new Error("not used here");
    },
    now: () => Date.now(),
  };
}

async function liveWorkspace(propose: Deps["proposeClaims"]) {
  const db = createDb(":memory:");
  const { workspaceId, token } = createWorkspace(db, { personName: "Ada Test", githubHandle: "ada", mode: "live" });
  const events: ImportEvent[] = [];
  await importProjects(db, token, [{ title: "Gizmo", role: "Author", urls: [{ url: "https://github.com/ada/gizmo" }] }], liveDeps(propose), (e) => events.push(e));
  return { db, workspaceId, token, events };
}

afterEach(() => vi.unstubAllGlobals());

describe("Demo stays offline and deterministic", () => {
  it("builds the EXAMPLE portfolio and kit with the network switched off", async () => {
    const fetch = vi.fn(() => Promise.reject(new Error("network is off in Demo")));
    vi.stubGlobal("fetch", fetch);
    const ctx = await exampleWorkspace();
    await approveAllAndEvaluate(ctx.db, ctx.token, ctx.workspaceId, ctx.profile.goal);
    const portfolio = buildPortfolio(ctx.db, ctx.workspaceId, { audience: "owner" })!;
    const packet = buildPacket(ctx.db, ctx.workspaceId)!;
    expect(fetch).not.toHaveBeenCalled();
    expect(portfolio.example).toBe(true);
    expect(portfolio.capabilities.length).toBeGreaterThan(0);
    expect(packet.example).toBe(true);
    expect(pdfFilename(packet)).toBe(PDF_FILENAME);
    expect(ctx.db.select().from(t.claims).all().every((c) => c.origin === "fixture")).toBe(true);
  });
});

describe("Live readiness says what to fix, per feature", () => {
  it("names the missing setting when no model is configured, and never calls the whole app live", () => {
    const none = liveReadiness({});
    const statements = none.find((r) => r.feature === "Statements with quotes")!;
    expect(statements.status).toBe("needs-setup");
    expect(statements.detail).toMatch(/AI_MODEL/);
    expect(statements.detail).toMatch(/\.env\.local/);

    const noKey = liveReadiness({ AI_MODEL: "anthropic:some-model" });
    expect(noKey.find((r) => r.feature === "Statements with quotes")!.detail).toMatch(/ANTHROPIC_API_KEY is not set/);

    const ready = liveReadiness({ AI_MODEL: "anthropic:some-model", ANTHROPIC_API_KEY: "x" });
    expect(ready.find((r) => r.feature === "Statements with quotes")!.status).toBe("ready");
    expect(ready.some((r) => r.status !== "ready")).toBe(true);
    expect(ready.find((r) => r.feature === "Discover")!.status).toBe("planned");
    expect(JSON.stringify(ready)).not.toContain("x\"");
  });
});

describe("A live failure is shown, never replaced", () => {
  it("records no statement at all when the model fails, and says why", async () => {
    const { db, workspaceId, events } = await liveWorkspace(async () => {
      throw new Error("ANTHROPIC_API_KEY is not set.");
    });
    const errors = events.filter((e): e is Extract<ImportEvent, { type: "error" }> => e.type === "error");
    expect(errors.map((e) => e.message).join(" ")).toMatch(/Claims for "Gizmo" failed: ANTHROPIC_API_KEY is not set\./);
    expect(loadSnapshot(db, workspaceId)!.projects.flatMap((p) => p.claims)).toEqual([]);
    expect(db.select().from(t.claims).all()).toEqual([]);
  });
});

describe("A real workspace's kit carries no EXAMPLE marks", () => {
  it("renders the kit with the person's own name, no synthetic labels, and a plain file name", async () => {
    const { db, workspaceId, token } = await liveWorkspace(async ({ sources }) => ({
      engine: "test model",
      questions: [],
      claims: [
        {
          text: "Built per-field merging of edits for devices that reconnect",
          kind: "contribution",
          attribution: "author",
          tags: ["sync"],
          legalFlag: null,
          quotes: [{ sourceId: sources[0]!.id, quote: "Merge per-field edits when devices reconnect" }],
        },
      ],
    }));
    for (const c of loadSnapshot(db, workspaceId)!.projects.flatMap((p) => p.claims)) reviewClaim(db, token, c.id, { action: "approve" });
    const packet = buildPacket(db, workspaceId)!;
    const body = renderPacketBody(packet, null);
    expect(packet.example).toBe(false);
    expect(body).not.toContain("EXAMPLE");
    expect(body).not.toContain("Rin");
    expect(body).toContain("Ada&#39;s part".replace("&#39;", "'"));
    expect(noticeFor(packet)).toBe(LIVE_NOTICE);
    expect(pdfFilename(packet)).toBe("ada-test-first-consultation-kit.pdf");
  });
});
