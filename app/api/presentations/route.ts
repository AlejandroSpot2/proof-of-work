import { getDb } from "@/lib/db/client";
import { createPresentation } from "@/lib/workspace";
import { handle, json, readJson, sessionFrom } from "@/lib/http";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ audience: string }>(req);
    const audience = body.audience === "attorney" ? "attorney" : "portfolio";
    const { id, token } = createPresentation(getDb(), sessionFrom(req), audience);
    return json({ ok: true, id, path: `/p/${token}` });
  });
}
