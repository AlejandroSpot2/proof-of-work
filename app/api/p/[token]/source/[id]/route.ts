import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { resolvePresentation } from "@/lib/workspace";
import { attorneyView, loadSnapshot, portfolioView, visibleSourceIds } from "@/lib/views/project";
import { handle, json } from "@/lib/http";

/** A presentation token may open a source only if that presentation shows evidence from it. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  return handle(async () => {
    const db = getDb();
    const { token, id } = await ctx.params;
    const pres = resolvePresentation(db, token);
    if (!pres) return json({ error: "Not found" }, { status: 404 });
    const snap = loadSnapshot(db, pres.workspaceId)!;
    const view = pres.audience === "portfolio" ? portfolioView(snap) : attorneyView(snap);
    if (!visibleSourceIds(view).has(id)) return json({ error: "Not found" }, { status: 404 });
    const s = db.select().from(t.sources).where(eq(t.sources.id, id)).get()!;
    return json({ id: s.id, url: s.url, locator: s.locator, status: s.status, fetchedAt: s.fetchedAt, contentHash: s.contentHash, text: s.snippetStore });
  });
}
