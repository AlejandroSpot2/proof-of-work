import { getDb } from "@/lib/db/client";
import { importProjects, ownerWorkspace, type ProjectInput } from "@/lib/workspace";
import { depsFor } from "@/lib/deps";
import { handle, json, readJson, sessionFrom } from "@/lib/http";
import { LIMITS } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

/** Streams import progress as NDJSON so sources appear with their status as they are fetched. */
export async function POST(req: Request) {
  return handle(async () => {
    const db = getDb();
    const session = sessionFrom(req);
    const ws = ownerWorkspace(db, session);
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    const body = await readJson<{ projects: ProjectInput[] }>(req);
    const projects = (body.projects ?? [])
      .slice(0, LIMITS.projects)
      .map((p) => ({
        title: String(p.title ?? "").trim().slice(0, 80),
        role: p.role ? String(p.role).slice(0, 80) : null,
        urls: (p.urls ?? []).slice(0, LIMITS.sourcesPerProject).map((u) => ({ url: String(u.url ?? "").trim(), ownPage: !!u.ownPage })).filter((u) => u.url),
      }))
      .filter((p) => p.title && p.urls.length);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (e: unknown) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        try {
          await importProjects(db, session, projects, depsFor(ws.mode), send);
        } catch (err) {
          send({ type: "error", message: (err as Error).message });
        }
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
  });
}
