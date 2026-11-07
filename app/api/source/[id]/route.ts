import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { ownerWorkspace } from "@/lib/workspace";
import { handle, json, sessionFrom } from "@/lib/http";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const db = getDb();
    const ws = ownerWorkspace(db, sessionFrom(req));
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    const { id } = await ctx.params;
    const s = db.select().from(t.sources).where(eq(t.sources.id, id)).get();
    const p = s && db.select().from(t.projects).where(eq(t.projects.id, s.projectId)).get();
    if (!s || !p || p.workspaceId !== ws.id) return json({ error: "Not found" }, { status: 404 });
    return json({ id: s.id, url: s.url, locator: s.locator, status: s.status, fetchedAt: s.fetchedAt, contentHash: s.contentHash, text: s.snippetStore });
  });
}
