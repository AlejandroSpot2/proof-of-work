import { getDb } from "@/lib/db/client";
import { attestClaim } from "@/lib/workspace";
import { handle, json, readJson, sessionFrom } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ projectId: string; text: string }>(req);
    const text = String(body.text ?? "").trim().slice(0, 240);
    if (text.length < 8) return json({ error: "Say what you did in a full sentence." }, { status: 400 });
    const id = attestClaim(getDb(), sessionFrom(req), String(body.projectId), text);
    return json({ ok: true, id });
  });
}
