import { getDb } from "@/lib/db/client";
import { reviewReading } from "@/lib/workspace";
import { handle, json, readJson, sessionFrom } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ key: string; action: string; note?: string }>(req);
    const action = body.action === "confirm_reading" ? "confirm_reading" : "reject_reading";
    reviewReading(getDb(), sessionFrom(req), String(body.key), action, body.note ? String(body.note).slice(0, 300) : null);
    return json({ ok: true });
  });
}
