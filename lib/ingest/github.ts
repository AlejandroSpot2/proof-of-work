import type { FetchedSource, GithubMeta } from "./types";
import { defaultAllowlist, safeFetch } from "./url";

export type FetchJsonResult =
  | { ok: true; status: number; data: unknown; text: string }
  | { ok: false; status: "blocked" | "unavailable"; reason: string };

export type FetchJson = (url: string, init?: { accept?: string }) => Promise<FetchJsonResult>;

const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const API = "https://api.github.com";
const RAW_ACCEPT = "application/vnd.github.raw";

export function parseGithubRepoUrl(raw: string): { owner: string; repo: string } | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || (host !== "github.com" && host !== "www.github.com")) return null;
  const [owner, rawRepo] = url.pathname.split("/").filter(Boolean);
  if (!owner || !rawRepo) return null;
  const repo = rawRepo.replace(/\.git$/i, "");
  if (!NAME_PATTERN.test(owner) || !NAME_PATTERN.test(repo) || repo === "." || repo === "..") return null;
  return { owner, repo };
}

function defaultFetchJson(token: string | undefined): FetchJson {
  const allowlist = defaultAllowlist([]);
  return async (url, init) => {
    const headers: Record<string, string> = {
      "User-Agent": "proof-of-work-hackathon",
      Accept: init?.accept ?? "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await safeFetch(url, { allowlist, headers });
    if (!res.ok) return res;
    let data: unknown = null;
    if (res.contentType.includes("json")) {
      try {
        data = JSON.parse(res.body);
      } catch {
        data = null;
      }
    }
    return { ok: true, status: res.status, data, text: res.body };
  };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

type Contributor = { login: string; contributions: number };
type Commit = { sha: string; message: string };

function parseContributors(data: unknown): Contributor[] | null {
  if (!Array.isArray(data)) return null;
  return data.flatMap((c) =>
    isObj(c) && typeof c.login === "string" && typeof c.contributions === "number"
      ? [{ login: c.login, contributions: c.contributions }]
      : [],
  );
}

function parseCommits(data: unknown): Commit[] | null {
  if (!Array.isArray(data)) return null;
  return data.flatMap((c) => {
    if (!isObj(c) || typeof c.sha !== "string") return [];
    const message = isObj(c.commit) && typeof c.commit.message === "string" ? c.commit.message : "";
    return [{ sha: c.sha, message }];
  });
}

function parseLanguages(data: unknown): Record<string, number> | null {
  if (!isObj(data)) return null;
  const out: Record<string, number> = {};
  for (const [name, bytes] of Object.entries(data)) if (typeof bytes === "number") out[name] = bytes;
  return out;
}

function renderRepository(data: unknown): string | null {
  if (!isObj(data)) return null;
  const owner = isObj(data.owner) ? str(data.owner.login) : null;
  const lines: [string, string | null][] = [
    ["Repository", str(data.full_name) ?? str(data.name)],
    ["Description", str(data.description)],
    ["Owner", owner],
    ["Default branch", str(data.default_branch)],
    ["Created", str(data.created_at)],
    ["Last pushed", str(data.pushed_at)],
    ["Homepage", str(data.homepage)],
  ];
  return lines.flatMap(([k, v]) => (v ? [`${k}: ${v}`] : [])).join("\n");
}

function renderLanguages(langs: Record<string, number>): string {
  const total = Object.values(langs).reduce((a, b) => a + b, 0);
  return Object.entries(langs)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([name, bytes]) => `${name}: ${total ? ((bytes / total) * 100).toFixed(1) : "0.0"}% of bytes`)
    .join("\n");
}

function renderContributors(list: Contributor[]): string {
  return list.map((c) => `${c.login}: ${c.contributions} commits`).join("\n");
}

function renderCommits(list: Commit[]): string {
  return list.map((c) => `${c.sha.slice(0, 7)} ${c.message.split("\n")[0] ?? ""}`).join("\n");
}

async function call(fetchJson: FetchJson, url: string, accept?: string): Promise<FetchJsonResult> {
  try {
    return await fetchJson(url, accept ? { accept } : undefined);
  } catch (err) {
    return { ok: false, status: "unavailable", reason: err instanceof Error ? err.message : String(err) };
  }
}

const okData = (r: FetchJsonResult): unknown => (r.ok ? r.data : null);

export async function fetchGithubProject(input: {
  url: string;
  handle: string;
  token?: string;
  fetchJson?: FetchJson;
}): Promise<FetchedSource[]> {
  const parsed = parseGithubRepoUrl(input.url);
  if (!parsed) {
    return [
      {
        url: input.url,
        kind: "github",
        status: "blocked",
        statusDetail: "not a GitHub repository URL",
        locator: "repository",
        text: "",
      },
    ];
  }
  const { owner, repo } = parsed;
  const handle = input.handle.trim().replace(/^@/, "");
  const author = encodeURIComponent(handle);
  const fetchJson = input.fetchJson ?? defaultFetchJson(input.token);
  const html = `https://github.com/${owner}/${repo}`;
  const api = `${API}/repos/${owner}/${repo}`;

  const [repoRes, readmeRes, langRes, contribRes, commitRes] = await Promise.all([
    call(fetchJson, api),
    call(fetchJson, `${api}/readme`, RAW_ACCEPT),
    call(fetchJson, `${api}/languages`),
    call(fetchJson, `${api}/contributors?per_page=30`),
    call(fetchJson, `${api}/commits?author=${author}&per_page=30`),
  ]);

  const repoData = okData(repoRes);
  const languages = parseLanguages(okData(langRes));
  const contributors = parseContributors(okData(contribRes));
  const commits = parseCommits(okData(commitRes));

  const ownerLogin = (isObj(repoData) && isObj(repoData.owner) && str(repoData.owner.login)) || owner;
  const sampled = contributors ?? [];
  const entry = sampled.find((c) => c.login.toLowerCase() === handle.toLowerCase());
  const meta: GithubMeta = {
    owner: ownerLogin,
    repo,
    handle,
    handleIsOwner: ownerLogin.toLowerCase() === handle.toLowerCase(),
    handleCommitCount: entry ? entry.contributions : (commits?.length ?? 0),
    totalCommitsSampled: sampled.reduce((n, c) => n + c.contributions, 0),
    ...(languages ? { languages } : {}),
  };

  const source = (url: string, locator: string, res: FetchJsonResult, text: string | null): FetchedSource => {
    const base = { url, kind: "github" as const, locator, meta };
    if (!res.ok) return { ...base, status: res.status, statusDetail: res.reason, text: "" };
    if (text === null) return { ...base, status: "unavailable", statusDetail: "unexpected response shape", text: "" };
    return { ...base, status: "ok", statusDetail: `HTTP ${res.status}`, text };
  };

  return [
    source(html, "repository", repoRes, renderRepository(repoData)),
    source(`${html}#readme`, "README", readmeRes, readmeRes.ok ? readmeRes.text.trim() : null),
    source(`${api}/languages`, "languages", langRes, languages && renderLanguages(languages)),
    source(`${html}/graphs/contributors`, "contributors", contribRes, contributors && renderContributors(contributors)),
    source(`${html}/commits?author=${author}`, `commits by @${handle}`, commitRes, commits && renderCommits(commits)),
  ];
}
