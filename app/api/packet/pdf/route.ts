import { getDb } from "@/lib/db/client";
import { ownerWorkspace } from "@/lib/workspace";
import { handle, json, sessionFrom } from "@/lib/http";
import { packetFor, pdfResponse } from "@/lib/packet/pdf";
import { buildPacket } from "@/lib/packet/model";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const db = getDb();
    const ws = ownerWorkspace(db, sessionFrom(req));
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    const draft = buildPacket(db, ws.id);
    if (draft && !draft.example && draft.summary.statements === 0) return json({ error: "Nothing to put in a kit yet. Build your portfolio first." }, { status: 409 });
    const rendered = await packetFor(db, ws.id);
    if (!rendered) return json({ error: "Not found" }, { status: 404 });
    return pdfResponse(rendered);
  });
}
