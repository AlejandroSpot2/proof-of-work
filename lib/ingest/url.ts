import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

export type SafeFetchResult =
  | { ok: true; finalUrl: string; status: number; contentType: string; body: string; truncated: boolean }
  | { ok: false; status: "blocked" | "unavailable"; reason: string };

export type FetchInit = {
  method: "GET";
  headers: Record<string, string>;
  redirect: "manual";
  signal: AbortSignal;
};

type BodyReader = {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(): Promise<void>;
};

export type HopResponse = {
  status: number;
  headers: { get(name: string): string | null };
  body: { getReader(): BodyReader; cancel(): Promise<void> } | null;
};

export type FetchImpl = (url: string, init: FetchInit) => Promise<HopResponse>;

export type SafeFetchOptions = {
  allowlist: ReadonlySet<string>;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  fetchImpl?: FetchImpl;
};

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal"];
const DEFAULT_HOSTS = ["github.com", "api.github.com", "raw.githubusercontent.com"];
const TEXT_CONTENT_TYPES = new Set(["application/json", "application/xhtml+xml", "application/vnd.github.raw"]);
const SSRF_ERROR_CODE = "ERR_SSRF_BLOCKED";

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "");
}

export function checkUrl(raw: string, allowlist: ReadonlySet<string>): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "not a valid URL" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "only https URLs are allowed" };
  if (url.username || url.password) return { ok: false, reason: "credentials in URL are not allowed" };
  if (url.port !== "" && url.port !== "443") return { ok: false, reason: `port ${url.port} is not allowed` };

  const host = normalizeHostname(url.hostname);
  if (!host) return { ok: false, reason: "missing hostname" };
  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: `host ${host} is internal` };
  }
  const literal = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (net.isIP(literal) !== 0 && !isPublicAddress(literal)) {
    return { ok: false, reason: `address ${literal} is not public` };
  }
  if (!allowlist.has(host)) return { ok: false, reason: `host ${host} is not on the allowlist` };
  return { ok: true, url };
}

function parseIPv4(ip: string): number[] | null {
  if (net.isIPv4(ip) === false) return null;
  return ip.split(".").map(Number);
}

function isPublicIPv4(o: number[]): boolean {
  const [a = 0, b = 0, c = 0] = o;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

function parseIPv6(ip: string): number[] | null {
  if (!net.isIPv6(ip)) return null;
  let text = ip.split("%")[0] ?? "";
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted?.[1]) {
    const v4 = parseIPv4(dotted[1]);
    if (!v4) return null;
    const hi = ((v4[0] ?? 0) << 8) | (v4[1] ?? 0);
    const lo = ((v4[2] ?? 0) << 8) | (v4[3] ?? 0);
    text = text.slice(0, -dotted[1].length) + `${hi.toString(16)}:${lo.toString(16)}`;
  }
  const [head = "", tail] = text.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const fill = tail === undefined ? 0 : 8 - headParts.length - tailParts.length;
  const groups = [...headParts, ...Array<string>(fill).fill("0"), ...tailParts].map((g) => parseInt(g, 16));
  return groups.length === 8 ? groups : null;
}

function embeddedV4(g: number[], hiIndex: number): number[] {
  const hi = g[hiIndex] ?? 0;
  const lo = g[hiIndex + 1] ?? 0;
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

function isPublicIPv6(g: number[]): boolean {
  const zeroPrefix = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeroPrefix(5) && g[5] === 0xffff) return isPublicIPv4(embeddedV4(g, 6));
  if (zeroPrefix(6)) return false;
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isPublicIPv4(embeddedV4(g, 6));
  }
  if (g[0] === 0x2002) return isPublicIPv4(embeddedV4(g, 1));
  if (g[0] === 0x2001 && g[1] === 0xdb8) return false;
  return ((g[0] ?? 0) & 0xe000) === 0x2000;
}

export function isPublicAddress(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4) return isPublicIPv4(v4);
  const v6 = parseIPv6(ip);
  if (v6) return isPublicIPv6(v6);
  return false;
}

export function defaultAllowlist(userUrls: string[]): Set<string> {
  const hosts = new Set(DEFAULT_HOSTS);
  for (const raw of userUrls) {
    try {
      const url = new URL(raw);
      if (url.protocol === "https:") hosts.add(normalizeHostname(url.hostname));
    } catch {
      continue;
    }
  }
  return hosts;
}

const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, family: options.family ?? 0 }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const bad = addresses.find((a) => !isPublicAddress(a.address));
    if (bad || addresses.length === 0) {
      const blocked = Object.assign(
        new Error(`${hostname} resolves to non-public address ${bad?.address ?? "(none)"}`),
        { code: SSRF_ERROR_CODE },
      ) as NodeJS.ErrnoException;
      return callback(blocked, "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    const first = addresses[0]!;
    callback(null, first.address, first.family);
  });
};

let guardedAgent: Agent | undefined;

const undiciImpl: FetchImpl = (url, init) => {
  guardedAgent ??= new Agent({ connect: { lookup: guardedLookup } });
  return undiciFetch(url, { ...init, dispatcher: guardedAgent }) as unknown as Promise<HopResponse>;
};

function findSsrfError(err: unknown): string | null {
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    if (typeof e === "object" && (e as { code?: unknown }).code === SSRF_ERROR_CODE) {
      return (e as Error).message;
    }
    e = typeof e === "object" ? (e as { cause?: unknown }).cause : undefined;
  }
  return null;
}

function mediaType(header: string | null): string {
  return (header ?? "").split(";")[0]!.trim().toLowerCase();
}

function isTextual(type: string): boolean {
  return type.startsWith("text/") || TEXT_CONTENT_TYPES.has(type);
}

class TimeoutError extends Error {}

async function readCapped(
  body: NonNullable<HopResponse["body"]>,
  maxBytes: number,
  aborted: Promise<never>,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), aborted]);
      if (done) break;
      if (!value) continue;
      if (size + value.byteLength > maxBytes) {
        chunks.push(value.subarray(0, maxBytes - size));
        size = maxBytes;
        await reader.cancel().catch(() => undefined);
        return { bytes: concat(chunks, size), truncated: true };
      }
      chunks.push(value);
      size += value.byteLength;
    }
  } catch (err) {
    await reader.cancel().catch(() => undefined);
    throw err;
  }
  return { bytes: concat(chunks, size), truncated: false };
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function discard(res: HopResponse): void {
  res.body?.cancel().catch(() => undefined);
}

export async function safeFetch(raw: string, opts: SafeFetchOptions): Promise<SafeFetchResult> {
  const maxBytes = opts.maxBytes ?? 200_000;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxRedirects = opts.maxRedirects ?? 3;
  const fetchImpl = opts.fetchImpl ?? undiciImpl;

  const controller = new AbortController();
  let rejectAborted: (e: Error) => void = () => undefined;
  const aborted = new Promise<never>((_, reject) => {
    rejectAborted = reject;
  });
  aborted.catch(() => undefined);
  const timer = setTimeout(() => {
    const err = new TimeoutError(`timed out after ${timeoutMs} ms`);
    rejectAborted(err);
    controller.abort(err);
  }, timeoutMs);

  try {
    let current = raw;
    for (let hop = 0; ; hop++) {
      const check = checkUrl(current, opts.allowlist);
      if (!check.ok) return { ok: false, status: "blocked", reason: check.reason };

      const res = await Promise.race([
        fetchImpl(check.url.href, {
          method: "GET",
          headers: opts.headers ?? {},
          redirect: "manual",
          signal: controller.signal,
        }),
        aborted,
      ]);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        discard(res);
        if (!location) return { ok: false, status: "unavailable", reason: `HTTP ${res.status} without Location` };
        if (hop >= maxRedirects) return { ok: false, status: "blocked", reason: `more than ${maxRedirects} redirects` };
        try {
          current = new URL(location, check.url).href;
        } catch {
          return { ok: false, status: "blocked", reason: "invalid redirect Location" };
        }
        continue;
      }
      if (res.status >= 400) {
        discard(res);
        return { ok: false, status: "unavailable", reason: `HTTP ${res.status}` };
      }

      const contentType = mediaType(res.headers.get("content-type"));
      if (!isTextual(contentType)) {
        discard(res);
        return { ok: false, status: "unavailable", reason: `unsupported content type ${contentType || "(none)"}` };
      }
      const { bytes, truncated } = res.body
        ? await readCapped(res.body, maxBytes, aborted)
        : { bytes: new Uint8Array(), truncated: false };
      return {
        ok: true,
        finalUrl: check.url.href,
        status: res.status,
        contentType,
        body: new TextDecoder().decode(bytes),
        truncated,
      };
    }
  } catch (err) {
    if (err instanceof TimeoutError || controller.signal.aborted) {
      return { ok: false, status: "unavailable", reason: `timed out after ${timeoutMs} ms` };
    }
    const ssrf = findSsrfError(err);
    if (ssrf) return { ok: false, status: "blocked", reason: ssrf };
    const cause = (err as { cause?: { message?: string } })?.cause?.message;
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: "unavailable", reason: cause ? `${message}: ${cause}` : message };
  } finally {
    clearTimeout(timer);
  }
}
