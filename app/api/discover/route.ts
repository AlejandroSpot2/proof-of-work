import { getDb } from "@/lib/db/client";
import { ownerWorkspace } from "@/lib/workspace";
import { depsFor } from "@/lib/deps";
import { handle, json, readJson, sessionFrom } from "@/lib/http";
import { VIEWS, type View } from "@/lib/discover";
import { discoverStatus, latestRuns, normalizeQuery, runDiscover, type DiscoverEvent } from "@/lib/discover-live";

export const dynamic = "force-dynamic";

/** What Discover can do in this workspace, and the latest results already paid for. Reading it never calls Treg. */
export async function GET(req: Request) {
  return handle(() => {
    const db = getDb();
    const ws = ownerWorkspace(db, sessionFrom(req));
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    return json({ status: discoverStatus(db, ws.mode), runs: latestRuns(db, ws) });
  });
}

/**
 * One press: at most one search call and one relevance call, streamed as NDJSON so results show before relevance.
 * A missing token or cap answers with what to set, before any call. Nothing falls back to the EXAMPLE list.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const db = getDb();
    const ws = ownerWorkspace(db, sessionFrom(req));
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    const body = await readJson<{ view?: unknown; query?: unknown }>(req);
    const view = VIEWS.find((v): v is View => v === body.view);
    const query = typeof body.query === "string" ? normalizeQuery(body.query) : "";
    if (!view) return json({ error: "Choose who to look for: cofounders or clients." }, { status: 400 });
    if (query.length < 3) return json({ error: "Write what you are looking for, in a few words." }, { status: 400 });
    const status = discoverStatus(db, ws.mode);
    if (status.mode === "live" && !status.ready) {
      return json({ error: `${status.reason} Add it to .env.local and restart the server. A token alone never spends: live searches stay off until both TREG_TOKEN and TREG_MAX_SPEND_MICRO are set.` }, { status: 409 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (e: DiscoverEvent) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
          } catch {}
        };
        try {
          await runDiscover(db, ws, view, query, depsFor(ws.mode).discover, send, () => req.signal.aborted);
          const after = discoverStatus(db, ws.mode);
          send({ type: "done", spend: after.mode === "live" && after.ready ? after.spend : null });
        } catch (err) {
          send({ type: "error", message: (err as Error).message });
        }
        try {
          controller.close();
        } catch {}
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
  });
}
