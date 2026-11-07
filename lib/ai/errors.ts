import { NoObjectGeneratedError } from "ai";

type Issue = { path?: PropertyKey[]; code?: string; maximum?: unknown; minimum?: unknown };

function issuesOf(e: unknown): Issue[] {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur; i++) {
    const issues = (cur as { issues?: Issue[] }).issues;
    if (Array.isArray(issues)) return issues;
    cur = (cur as { cause?: unknown }).cause;
  }
  return [];
}

/** Names which schema rule the model broke (path and rule only, never the model's content or any key). */
export function describeModelError(err: unknown): Error {
  if (!NoObjectGeneratedError.isInstance(err)) return err instanceof Error ? err : new Error(String(err));
  const issues = issuesOf(err.cause)
    .slice(0, 4)
    .map((i) => `${(i.path ?? []).map(String).join(".") || "(root)"}: ${i.code ?? "invalid"}${i.maximum !== undefined ? ` max ${String(i.maximum)}` : ""}${i.minimum !== undefined ? ` min ${String(i.minimum)}` : ""}`);
  return new Error(`The model's answer did not match the schema${issues.length ? ` (${issues.join("; ")})` : ""}. Finish reason: ${err.finishReason ?? "unknown"}.`);
}
