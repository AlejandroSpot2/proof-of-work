import { OWNER_COOKIE, readCookie } from "@/lib/auth";
import { OwnerError } from "@/lib/workspace";

export function sessionFrom(req: Request): string | null {
  return readCookie(req.headers.get("cookie"), OWNER_COOKIE);
}

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init.headers ?? {}) } });
}

/** Mutations accept JSON only, which a cross-site form post cannot send; the session cookie is SameSite=Strict as well. */
export async function readJson<T>(req: Request): Promise<T> {
  if (!req.headers.get("content-type")?.includes("application/json")) throw new OwnerError("Expected JSON");
  return (await req.json()) as T;
}

export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof OwnerError) return json({ error: err.message }, { status: 403 });
    console.error(err);
    return json({ error: (err as Error).message || "Something went wrong" }, { status: 500 });
  }
}
