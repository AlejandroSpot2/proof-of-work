import { getDb } from "@/lib/db/client";
import { MODE_COOKIE, ownerCookie, readCookie } from "@/lib/auth";
import { ownerWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * The Demo/Live switch. Each mode keeps its own workspace in its own cookie; switching makes that one active.
 * A mode with no workspace yet goes to where one is made: the EXAMPLE start for Demo, /live for Live.
 */
export async function GET(req: Request) {
  const to = new URL(req.url).searchParams.get("to") === "live" ? "live" : "fixture";
  const cookies = req.headers.get("cookie");
  const db = getDb();
  const remembered = readCookie(cookies, MODE_COOKIE[to]);
  const ws = ownerWorkspace(db, remembered);
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (remembered && ws && ws.mode === to) {
    headers.set("Location", "/studio");
    headers.append("Set-Cookie", ownerCookie(remembered));
    return new Response(null, { status: 303, headers });
  }
  headers.set("Location", to === "live" ? "/live" : "/api/example/start?to=/studio");
  return new Response(null, { status: 303, headers });
}
