import { getDb } from "@/lib/db/client";
import { ownerWorkspace } from "@/lib/workspace";
import { buildPortfolio, updatePortfolioSettings } from "@/lib/portfolio";
import { handle, json, readJson, sessionFrom } from "@/lib/http";
import { modelStatus } from "@/lib/ai/model";

export async function GET(req: Request) {
  return handle(() => {
    const db = getDb();
    const ws = ownerWorkspace(db, sessionFrom(req));
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    return json(buildPortfolio(db, ws.id, { audience: "owner" }));
  });
}

/** Owner edits to the portfolio's own words and which projects it shows. Statements are edited through review, not here. */
export async function POST(req: Request) {
  return handle(async () => {
    const db = getDb();
    const ws = ownerWorkspace(db, sessionFrom(req));
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    const body = await readJson<{ headline?: unknown; intro?: unknown; hidden?: unknown; builtAt?: unknown; cv?: unknown }>(req);
    const builtAt = typeof body.builtAt === "number" ? body.builtAt : undefined;
    const model = modelStatus();
    updatePortfolioSettings(db, ws.id, {
      headline: typeof body.headline === "string" ? body.headline : undefined,
      intro: typeof body.intro === "string" ? body.intro : undefined,
      hidden: Array.isArray(body.hidden) ? body.hidden.filter((x): x is string => typeof x === "string").slice(0, 10) : undefined,
      builtAt,
      cv: typeof body.cv === "string" ? body.cv : undefined,
      // provenance is the server's record of the build, never the client's
      provenance:
        builtAt === undefined
          ? undefined
          : ws.mode === "fixture"
            ? { mode: "demo", engine: "recorded EXAMPLE statements, no model", at: Date.now() }
            : { mode: "live", engine: model.ready ? model.label : "no model configured", at: Date.now() },
    });
    return json(buildPortfolio(db, ws.id, { audience: "owner" }));
  });
}
