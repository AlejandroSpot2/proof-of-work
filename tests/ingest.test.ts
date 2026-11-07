import { describe, expect, it } from "vitest";
import { fetchGithubProject, parseGithubRepoUrl, type FetchJson, type FetchJsonResult } from "@/lib/ingest/github";
import { fetchWebSource, htmlToText } from "@/lib/ingest/web";
import type { FetchImpl } from "@/lib/ingest/url";

const API = "https://api.github.com/repos/acme/widget";

const fixtures: Record<string, FetchJsonResult> = {
  [API]: {
    ok: true,
    status: 200,
    text: "",
    data: {
      full_name: "acme/widget",
      description: "A widget",
      owner: { login: "Acme" },
      default_branch: "main",
      created_at: "2024-01-01T00:00:00Z",
      pushed_at: "2025-06-01T00:00:00Z",
      homepage: "https://widget.dev",
    },
  },
  [`${API}/readme`]: { ok: true, status: 200, data: null, text: "# Widget\nDoes things.\n" },
  [`${API}/languages`]: { ok: true, status: 200, text: "", data: { TypeScript: 750, CSS: 250 } },
  [`${API}/contributors?per_page=30`]: {
    ok: true,
    status: 200,
    text: "",
    data: [
      { login: "alice", contributions: 120 },
      { login: "bob", contributions: 30 },
    ],
  },
  [`${API}/commits?author=alice&per_page=30`]: {
    ok: true,
    status: 200,
    text: "",
    data: [
      { sha: "abcdef1234567", commit: { message: "Add parser\n\nlong body" } },
      { sha: "1234567abcdef", commit: { message: "Fix bug" } },
    ],
  },
  [`${API}/commits?author=carol&per_page=30`]: { ok: true, status: 200, text: "", data: [] },
};

function fakeJson(overrides: Record<string, FetchJsonResult> = {}, calls: string[] = []): FetchJson {
  return async (url) => {
    calls.push(url);
    return overrides[url] ?? fixtures[url] ?? { ok: false, status: "unavailable", reason: "HTTP 404" };
  };
}

describe("parseGithubRepoUrl", () => {
  it.each([
    ["https://github.com/acme/widget", { owner: "acme", repo: "widget" }],
    ["https://github.com/acme/widget.git", { owner: "acme", repo: "widget" }],
    ["https://github.com/acme/widget/tree/main/src", { owner: "acme", repo: "widget" }],
    ["https://www.github.com/acme/widget/", { owner: "acme", repo: "widget" }],
    ["https://github.com/acme", null],
    ["https://gitlab.com/acme/widget", null],
    ["http://github.com/acme/widget", null],
    ["nope", null],
  ])("%s", (raw, expected) => {
    expect(parseGithubRepoUrl(raw)).toEqual(expected);
  });
});

describe("fetchGithubProject", () => {
  it("returns five rendered sources with shared meta", async () => {
    const calls: string[] = [];
    const sources = await fetchGithubProject({ url: "https://github.com/acme/widget", handle: "@alice", fetchJson: fakeJson({}, calls) });
    expect(calls).toHaveLength(5);
    expect(sources.map((s) => [s.locator, s.url, s.status])).toEqual([
      ["repository", "https://github.com/acme/widget", "ok"],
      ["README", "https://github.com/acme/widget#readme", "ok"],
      ["languages", `${API}/languages`, "ok"],
      ["contributors", "https://github.com/acme/widget/graphs/contributors", "ok"],
      ["commits by @alice", "https://github.com/acme/widget/commits?author=alice", "ok"],
    ]);
    const [repo, readme, langs, contribs, commits] = sources.map((s) => s.text);
    expect(repo).toContain("Repository: acme/widget");
    expect(repo).toContain("Owner: Acme");
    expect(readme).toBe("# Widget\nDoes things.");
    expect(langs).toBe("TypeScript: 75.0% of bytes\nCSS: 25.0% of bytes");
    expect(contribs).toBe("alice: 120 commits\nbob: 30 commits");
    expect(commits).toBe("abcdef1 Add parser\n1234567 Fix bug");
    for (const s of sources) {
      expect(s.kind).toBe("github");
      expect(s.meta).toEqual({
        owner: "Acme",
        repo: "widget",
        handle: "alice",
        handleIsOwner: false,
        handleCommitCount: 120,
        totalCommitsSampled: 150,
        languages: { TypeScript: 750, CSS: 250 },
      });
    }
  });

  it("marks only the README unavailable when it 404s", async () => {
    const sources = await fetchGithubProject({
      url: "https://github.com/acme/widget",
      handle: "alice",
      fetchJson: fakeJson({ [`${API}/readme`]: { ok: false, status: "unavailable", reason: "HTTP 404" } }),
    });
    const readme = sources.find((s) => s.locator === "README");
    expect(readme).toMatchObject({ status: "unavailable", statusDetail: "HTTP 404", text: "" });
    expect(sources.filter((s) => s.status === "ok")).toHaveLength(4);
  });

  it("reports handleCommitCount 0 when the handle is absent from contributors", async () => {
    const sources = await fetchGithubProject({ url: "https://github.com/acme/widget", handle: "carol", fetchJson: fakeJson() });
    expect(sources[0]?.meta).toMatchObject({ handleCommitCount: 0, handleIsOwner: false, totalCommitsSampled: 150 });
    expect(sources[4]?.text).toBe("");
  });

  it("detects ownership case-insensitively", async () => {
    const sources = await fetchGithubProject({ url: "https://github.com/acme/widget", handle: "acme", fetchJson: fakeJson() });
    expect(sources[0]?.meta?.handleIsOwner).toBe(true);
  });

  it("still returns the other sources when the repo endpoint fails", async () => {
    const sources = await fetchGithubProject({
      url: "https://github.com/acme/widget",
      handle: "alice",
      fetchJson: fakeJson({ [API]: { ok: false, status: "blocked", reason: "host not allowlisted" } }),
    });
    expect(sources).toHaveLength(5);
    expect(sources[0]).toMatchObject({ status: "blocked", text: "" });
    expect(sources.slice(1).every((s) => s.status === "ok")).toBe(true);
    expect(sources[0]?.meta?.owner).toBe("acme");
  });

  it("treats an unexpected payload shape as unavailable", async () => {
    const sources = await fetchGithubProject({
      url: "https://github.com/acme/widget",
      handle: "alice",
      fetchJson: fakeJson({ [`${API}/languages`]: { ok: true, status: 200, text: "", data: "oops" } }),
    });
    expect(sources[2]).toMatchObject({ status: "unavailable", statusDetail: "unexpected response shape" });
    expect(sources[2]?.meta?.languages).toBeUndefined();
  });

  it("rejects a non-GitHub URL without fetching", async () => {
    const calls: string[] = [];
    const sources = await fetchGithubProject({ url: "https://example.com/x/y", handle: "alice", fetchJson: fakeJson({}, calls) });
    expect(calls).toEqual([]);
    expect(sources).toEqual([expect.objectContaining({ status: "blocked" })]);
  });
});

describe("htmlToText", () => {
  it("strips scripts, styles, and head, keeps block structure, decodes entities", () => {
    const html = `<!doctype html><html><head><title>T</title><style>p{color:red}</style></head>
      <body><script>alert("x")</script><noscript>enable js</noscript>
      <h1>Hello&nbsp;&amp; welcome</h1><p>Line   one<br>Line two</p>
      <ul><li>a &lt;b&gt;</li><li>&quot;q&quot; &#39;s&#39; &#x263A; &#65;</li></ul>
      <svg><text>vector</text></svg><!-- hidden --></body></html>`;
    expect(htmlToText(html)).toBe(`Hello & welcome\nLine one\nLine two\na <b>\n"q" 's' ☺ A`);
  });

  it("drops an unterminated script to the end", () => {
    expect(htmlToText("<p>keep</p><script>var x = '<p>leak</p>'")).toBe("keep");
  });

  it("is deterministic", () => {
    const html = "<div>x</div><p>y</p>";
    expect(htmlToText(html)).toBe(htmlToText(html));
  });
});

describe("fetchWebSource", () => {
  const allow = new Set(["widget.dev"]);
  const page = (contentType: string, body: string): FetchImpl => async () =>
    new Response(body, { status: 200, headers: { "content-type": contentType } });

  it("converts HTML to text", async () => {
    const src = await fetchWebSource("https://widget.dev/", allow, page("text/html", "<p>Built by <b>alice</b></p><script>x()</script>"));
    expect(src).toEqual({ url: "https://widget.dev/", kind: "web", locator: "page", status: "ok", statusDetail: "HTTP 200", text: "Built by alice" });
  });

  it("keeps plain text as is", async () => {
    const src = await fetchWebSource("https://widget.dev/a.txt", allow, page("text/plain", "  raw <b>text</b>\n"));
    expect(src.text).toBe("raw <b>text</b>");
  });

  it("carries blocked status from safeFetch", async () => {
    const src = await fetchWebSource("https://other.dev/", allow, page("text/html", "x"));
    expect(src).toMatchObject({ status: "blocked", text: "" });
  });
});
