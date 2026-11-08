import { getDb } from "@/lib/db/client";
import { ownerCookie, rememberCookie } from "@/lib/auth";
import { createWorkspace } from "@/lib/workspace";
import { loadProfile } from "@/lib/fixtures/rin";
import { handle, json, readJson } from "@/lib/http";

type Body = { mode: "fixture" } | { mode: "live"; personName: string; githubHandle: string };

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<Body>(req);
    const input =
      body.mode === "fixture"
        ? (() => {
            const p = loadProfile();
            return { personName: p.name, githubHandle: p.handle, mode: "fixture" as const };
          })()
        : {
            personName: String(body.personName ?? "").trim().slice(0, 80),
            githubHandle: String(body.githubHandle ?? "").trim().replace(/^@/, "").slice(0, 40),
            mode: "live" as const,
          };
    if (!input.personName || !/^[A-Za-z0-9-]{1,39}$/.test(input.githubHandle)) {
      return json({ error: "A name and a valid GitHub handle are required." }, { status: 400 });
    }
    const { token } = createWorkspace(getDb(), input);
    const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
    headers.append("Set-Cookie", ownerCookie(token));
    headers.append("Set-Cookie", rememberCookie(input.mode, token));
    return new Response(JSON.stringify({ ok: true }), { headers });
  });
}
