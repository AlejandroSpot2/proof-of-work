import { getDb } from "@/lib/db/client";
import { revokePresentation } from "@/lib/workspace";
import { handle, json, sessionFrom } from "@/lib/http";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    revokePresentation(getDb(), sessionFrom(req), id);
    return json({ ok: true });
  });
}
