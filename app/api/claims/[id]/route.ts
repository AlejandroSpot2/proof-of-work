import { getDb } from "@/lib/db/client";
import { reviewClaim, type ClaimReview } from "@/lib/workspace";
import { ATTRIBUTIONS } from "@/lib/domain/types";
import { handle, json, readJson, sessionFrom } from "@/lib/http";

function parse(body: Record<string, unknown>): ClaimReview | null {
  switch (body.action) {
    case "approve":
      return { action: "approve" };
    case "reject":
      return { action: "reject", note: typeof body.note === "string" ? body.note.slice(0, 300) : undefined };
    case "publishable":
      return { action: "publishable", publishable: !!body.publishable };
    case "correct": {
      const attribution = ATTRIBUTIONS.find((a) => a === body.attribution);
      return {
        action: "correct",
        text: typeof body.text === "string" ? body.text.slice(0, 240) : undefined,
        attribution,
        attributionNote: typeof body.attributionNote === "string" ? body.attributionNote.slice(0, 240) : undefined,
        note: typeof body.note === "string" ? body.note.slice(0, 300) : undefined,
      };
    }
    default:
      return null;
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const review = parse(await readJson<Record<string, unknown>>(req));
    if (!review) return json({ error: "Unknown action" }, { status: 400 });
    const claim = reviewClaim(getDb(), sessionFrom(req), id, review);
    return json({ ok: true, claim: { id: claim.id, revision: claim.revision, state: claim.state } });
  });
}
