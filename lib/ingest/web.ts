import type { FetchedSource } from "./types";
import { safeFetch, type FetchImpl } from "./url";

const DROPPED = "script|style|noscript|svg|head|template";
const BLOCK_TAGS =
  "address|article|aside|blockquote|br|dd|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|td|th|title|tr|ul";
const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] !== "#") return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : match;
  });
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?(-->|$)/g, "")
    .replace(new RegExp(`<(${DROPPED})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<(${DROPPED})\\b[\\s\\S]*$`, "i"), "")
    .replace(new RegExp(`<\\/?(${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(stripped)
    .split(/\r?\n|\r/)
    .map((line) => line.replace(/[\s ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export async function fetchWebSource(
  url: string,
  allowlist: ReadonlySet<string>,
  fetchImpl?: FetchImpl,
): Promise<FetchedSource> {
  const base = { url, kind: "web" as const, locator: "page" };
  const res = await safeFetch(url, { allowlist, fetchImpl, headers: { "User-Agent": "proof-of-work-hackathon" } });
  if (!res.ok) return { ...base, status: res.status, statusDetail: res.reason, text: "" };
  const isHtml = res.contentType === "text/html" || res.contentType === "application/xhtml+xml";
  return {
    ...base,
    status: "ok",
    statusDetail: `HTTP ${res.status}${res.truncated ? ", truncated" : ""}`,
    text: isHtml ? htmlToText(res.body) : res.body.trim(),
  };
}
