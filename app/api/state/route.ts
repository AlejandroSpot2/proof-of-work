import { getDb } from "@/lib/db/client";
import { ownerWorkspace } from "@/lib/workspace";
import { attorneyView, deriveEntrust, loadSnapshot, portfolioView } from "@/lib/views/project";
import { loadProfile } from "@/lib/fixtures/rin";
import { modelStatus } from "@/lib/ai/model";
import { handle, json, sessionFrom } from "@/lib/http";
import { opportunitiesFor } from "@/lib/opportunities";

export async function GET(req: Request) {
  return handle(() => {
    const db = getDb();
    const ws = ownerWorkspace(db, sessionFrom(req));
    if (!ws) return json({ error: "No owner session" }, { status: 401 });
    const snapshot = loadSnapshot(db, ws.id)!;
    const entrust = deriveEntrust(snapshot);
    const profile = ws.mode === "fixture" ? loadProfile() : null;
    return json({
      snapshot,
      entrust,
      portfolio: portfolioView(snapshot),
      attorney: attorneyView(snapshot),
      opportunities: ws.mode === "fixture" ? opportunitiesFor(entrust) : [],
      example: profile && { disclaimer: profile.disclaimer, goal: profile.goal, role: profile.role, bio: profile.bio, projects: profile.projects, correction: profile.exampleCorrection },
      model: ws.mode === "live" ? modelStatus() : null,
    });
  });
}
