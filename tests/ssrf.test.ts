import { describe, expect, it } from "vitest";
import { checkUrl, defaultAllowlist, isPublicAddress, safeFetch, type FetchImpl } from "@/lib/ingest/url";

const allow = new Set(["example.com", "github.com"]);

type FakeHop = { status: number; headers?: Record<string, string>; body?: string | Uint8Array<ArrayBuffer> };

function fakeFetch(routes: Record<string, FakeHop>, seen: string[] = []): FetchImpl {
  return async (url) => {
    seen.push(url);
    const hop = routes[url];
    if (!hop) throw new Error(`unexpected fetch ${url}`);
    return new Response(hop.body ?? null, { status: hop.status, headers: hop.headers });
  };
}

describe("checkUrl", () => {
  it("accepts an allowlisted https URL", () => {
    expect(checkUrl("https://example.com/a", allow).ok).toBe(true);
    expect(checkUrl("https://EXAMPLE.com./a", allow).ok).toBe(true);
    expect(checkUrl("https://example.com:443/a", allow).ok).toBe(true);
  });

  it.each([
    ["http://example.com/", "https"],
    ["https://user:pw@example.com/", "credentials"],
    ["https://user@example.com/", "credentials"],
    ["https://evil.com/", "allowlist"],
    ["https://example.com:8443/", "port"],
    ["https://localhost/", "internal"],
    ["https://foo.localhost/", "internal"],
    ["https://printer.local/", "internal"],
    ["https://db.internal/", "internal"],
    ["https://metadata.google.internal/computeMetadata/v1/", "internal"],
    ["https://127.0.0.1/", "not public"],
    ["https://2130706433/", "not public"],
    ["https://0x7f000001/", "not public"],
    ["https://0x7f.1/", "not public"],
    ["https://017700000001/", "not public"],
    ["https://[::1]/", "not public"],
    ["https://[::ffff:127.0.0.1]/", "not public"],
    ["https://169.254.169.254/latest/meta-data/", "not public"],
    ["https://10.0.0.1/", "not public"],
    ["https://192.168.1.1/", "not public"],
    ["not a url", "valid"],
  ])("rejects %s", (raw, reason) => {
    const res = checkUrl(raw, allow);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain(reason);
  });

  it("rejects a public IP literal that is not allowlisted", () => {
    expect(checkUrl("https://8.8.8.8/", allow).ok).toBe(false);
  });
});

describe("isPublicAddress", () => {
  it.each([
    "0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255",
    "192.0.0.8", "192.168.0.1", "198.18.0.1", "224.0.0.1", "240.0.0.1", "255.255.255.255",
    "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1",
    "::ffff:10.0.0.1", "64:ff9b::a9fe:a9fe", "2001:db8::1", "not-an-ip",
  ])("%s is not public", (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });

  it.each(["8.8.8.8", "140.82.112.3", "172.32.0.1", "100.128.0.1", "2606:4700::1111", "::ffff:8.8.8.8", "64:ff9b::808:808"])(
    "%s is public",
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );
});

describe("defaultAllowlist", () => {
  it("includes GitHub hosts and https user hosts only", () => {
    const list = defaultAllowlist(["https://My.Site.dev/x", "http://insecure.dev/", "garbage"]);
    expect([...list].sort()).toEqual(["api.github.com", "github.com", "my.site.dev", "raw.githubusercontent.com"]);
  });
});

describe("safeFetch", () => {
  it("returns the body of an allowlisted text response", async () => {
    const res = await safeFetch("https://example.com/", {
      allowlist: allow,
      fetchImpl: fakeFetch({ "https://example.com/": { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: "<p>hi</p>" } }),
    });
    expect(res).toEqual({ ok: true, finalUrl: "https://example.com/", status: 200, contentType: "text/html", body: "<p>hi</p>", truncated: false });
  });

  it("blocks without fetching when the first URL fails the check", async () => {
    const seen: string[] = [];
    const res = await safeFetch("https://127.0.0.1/", { allowlist: allow, fetchImpl: fakeFetch({}, seen) });
    expect(res).toMatchObject({ ok: false, status: "blocked" });
    expect(seen).toEqual([]);
  });

  it("blocks a redirect to the metadata address", async () => {
    const seen: string[] = [];
    const res = await safeFetch("https://example.com/r", {
      allowlist: allow,
      fetchImpl: fakeFetch({ "https://example.com/r": { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" } } }, seen),
    });
    expect(res).toMatchObject({ ok: false, status: "blocked" });
    expect(seen).toEqual(["https://example.com/r"]);
  });

  it("blocks a redirect to a non-allowlisted host", async () => {
    const res = await safeFetch("https://example.com/r", {
      allowlist: allow,
      fetchImpl: fakeFetch({ "https://example.com/r": { status: 301, headers: { location: "https://evil.com/" } } }),
    });
    expect(res).toMatchObject({ ok: false, status: "blocked", reason: expect.stringContaining("allowlist") });
  });

  it("follows relative redirects within the allowlist", async () => {
    const res = await safeFetch("https://example.com/a", {
      allowlist: allow,
      fetchImpl: fakeFetch({
        "https://example.com/a": { status: 302, headers: { location: "/b" } },
        "https://example.com/b": { status: 200, headers: { "content-type": "text/plain" }, body: "done" },
      }),
    });
    expect(res).toMatchObject({ ok: true, finalUrl: "https://example.com/b", body: "done" });
  });

  it("blocks more than 3 redirects", async () => {
    const routes: Record<string, FakeHop> = {};
    for (let i = 0; i < 5; i++) routes[`https://example.com/${i}`] = { status: 302, headers: { location: `/${i + 1}` } };
    routes["https://example.com/5"] = { status: 200, headers: { "content-type": "text/plain" }, body: "x" };
    const seen: string[] = [];
    const res = await safeFetch("https://example.com/0", { allowlist: allow, fetchImpl: fakeFetch(routes, seen) });
    expect(res).toMatchObject({ ok: false, status: "blocked", reason: expect.stringContaining("redirects") });
    expect(seen).toHaveLength(4);
  });

  it("allows exactly 3 redirects", async () => {
    const routes: Record<string, FakeHop> = {};
    for (let i = 0; i < 3; i++) routes[`https://example.com/${i}`] = { status: 302, headers: { location: `/${i + 1}` } };
    routes["https://example.com/3"] = { status: 200, headers: { "content-type": "text/plain" }, body: "x" };
    const res = await safeFetch("https://example.com/0", { allowlist: allow, fetchImpl: fakeFetch(routes) });
    expect(res.ok).toBe(true);
  });

  it("reports 404 as unavailable", async () => {
    const res = await safeFetch("https://example.com/missing", {
      allowlist: allow,
      fetchImpl: fakeFetch({ "https://example.com/missing": { status: 404, headers: { "content-type": "text/plain" }, body: "no" } }),
    });
    expect(res).toEqual({ ok: false, status: "unavailable", reason: "HTTP 404" });
  });

  it("reports a timeout as unavailable", async () => {
    const hang: FetchImpl = (_url, init) =>
      new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)));
    const res = await safeFetch("https://example.com/slow", { allowlist: allow, timeoutMs: 20, fetchImpl: hang });
    expect(res).toMatchObject({ ok: false, status: "unavailable", reason: expect.stringContaining("timed out") });
  });

  it("times out even when the fake ignores the abort signal", async () => {
    const never: FetchImpl = () => new Promise(() => undefined);
    const res = await safeFetch("https://example.com/slow", { allowlist: allow, timeoutMs: 20, fetchImpl: never });
    expect(res).toMatchObject({ ok: false, status: "unavailable" });
  });

  it("truncates a body over maxBytes", async () => {
    const res = await safeFetch("https://example.com/big", {
      allowlist: allow,
      maxBytes: 10,
      fetchImpl: fakeFetch({ "https://example.com/big": { status: 200, headers: { "content-type": "text/plain" }, body: "a".repeat(50) } }),
    });
    expect(res).toMatchObject({ ok: true, truncated: true, body: "a".repeat(10) });
  });

  it("rejects non-text content types", async () => {
    const res = await safeFetch("https://example.com/img", {
      allowlist: allow,
      fetchImpl: fakeFetch({ "https://example.com/img": { status: 200, headers: { "content-type": "image/png" }, body: new Uint8Array([1, 2]) } }),
    });
    expect(res).toMatchObject({ ok: false, status: "unavailable", reason: expect.stringContaining("content type") });
  });

  it("turns a thrown fetch error into unavailable", async () => {
    const boom: FetchImpl = async () => {
      throw new Error("ECONNRESET");
    };
    const res = await safeFetch("https://example.com/", { allowlist: allow, fetchImpl: boom });
    expect(res).toMatchObject({ ok: false, status: "unavailable", reason: "ECONNRESET" });
  });
});
