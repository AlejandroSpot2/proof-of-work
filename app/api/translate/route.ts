import { getDb } from "@/lib/db/client";
import { ownerWorkspace } from "@/lib/workspace";
import { depsFor } from "@/lib/deps";
import { handle, json, sessionFrom } from "@/lib/http";
import { cachedTranslation, translatePortfolio } from "@/lib/translate";

export const dynamic = "force-dynamic";

/** The cached Spanish translation, if any. Reading it never calls a model. */
export async function GET(req: Request) {
  return handle(() => {
    const db = getDb();
    const ws = ownerWorkspace(db, sessionFrom(req));
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    return json({ translation: cachedTranslation(db, ws.id, "es") });
  });
}

/** Translate on the owner's request only. Live: one model call for the words not cached yet. A failure is returned as is. */
export async function POST(req: Request) {
  return handle(async () => {
    const db = getDb();
    const ws = ownerWorkspace(db, sessionFrom(req));
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    try {
      return json({ translation: await translatePortfolio(db, ws.id, "es", depsFor(ws.mode)) });
    } catch (err) {
      return json({ error: `Translation failed: ${(err as Error).message} Nothing was translated.` }, { status: 502 });
    }
  });
}
