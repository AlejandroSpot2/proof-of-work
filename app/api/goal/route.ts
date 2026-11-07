import { getDb } from "@/lib/db/client";
import { evaluateGoal, ownerWorkspace, setGoal } from "@/lib/workspace";
import { depsFor } from "@/lib/deps";
import { handle, json, readJson, sessionFrom } from "@/lib/http";

/** { text } sets a new goal and answers it; {} re-answers the current goal (no call if the ledger is unchanged). */
export async function POST(req: Request) {
  return handle(async () => {
    const db = getDb();
    const session = sessionFrom(req);
    const ws = ownerWorkspace(db, session);
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    const body = await readJson<{ text?: string }>(req);
    if (typeof body.text === "string") setGoal(db, session, body.text);
    const projection = await evaluateGoal(db, session, depsFor(ws.mode));
    return json({ ok: true, engine: projection.engine });
  });
}
