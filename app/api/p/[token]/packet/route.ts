import { getDb } from "@/lib/db/client";
import { resolvePresentation } from "@/lib/workspace";
import { handle, json } from "@/lib/http";
import { packetFor, pdfResponse } from "@/lib/packet/pdf";

export const dynamic = "force-dynamic";

/** The packet for an attorney link only; a portfolio link, a revoked link or an unknown token gets 404. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await ctx.params;
    const db = getDb();
    const pres = resolvePresentation(db, token);
    if (!pres || pres.audience !== "attorney") return json({ error: "Not found" }, { status: 404 });
    const rendered = await packetFor(db, pres.workspaceId);
    if (!rendered) return json({ error: "Not found" }, { status: 404 });
    return pdfResponse(rendered);
  });
}
