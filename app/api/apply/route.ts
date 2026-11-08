import { getDb } from "@/lib/db/client";
import { ownerWorkspace } from "@/lib/workspace";
import { depsFor } from "@/lib/deps";
import { handle, json, readJson, sessionFrom } from "@/lib/http";
import { POSTING_MAX } from "@/lib/requirements";

export const dynamic = "force-dynamic";

/** Reads a pasted job posting into requirements. Nothing is stored and nothing is applied to. */
export async function POST(req: Request) {
  return handle(async () => {
    const db = getDb();
    const ws = ownerWorkspace(db, sessionFrom(req));
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    const body = await readJson<{ posting?: unknown }>(req);
    const posting = typeof body.posting === "string" ? body.posting.trim().slice(0, POSTING_MAX) : "";
    if (posting.split(/\s+/).length < 8) return json({ error: "Paste the posting's text: at least a few lines with its requirements." }, { status: 400 });
    try {
      const extracted = await depsFor(ws.mode).extractRequirements(posting);
      if (!extracted.requirements.length) return json({ error: "No requirement could be read from this text. Paste the part of the posting that lists what they ask for." }, { status: 422 });
      return json({ extracted, provenance: { mode: ws.mode === "fixture" ? "demo" : "live", engine: extracted.engine, at: Date.now() } });
    } catch (err) {
      return json({ error: `Reading the posting failed: ${(err as Error).message} Nothing was filled in.` }, { status: 502 });
    }
  });
}
