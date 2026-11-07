import fs from "node:fs";
import path from "node:path";
import type { Authorship, FetchedSource, GithubMeta } from "@/lib/ingest/types";
import type { Attribution, ClaimKind } from "@/lib/domain/types";

/**
 * EXAMPLE data. Rin Okafor is a fictional builder; every file under fixtures/example-rin is synthetic.
 * Fixture ids use the example:// scheme so nothing looks like a real website or GitHub account.
 */
const ROOT = path.join(process.cwd(), "fixtures", "example-rin");
export const EXAMPLE_SCHEME = "example://";

export type ExampleProfile = {
  example: true;
  disclaimer: string;
  name: string;
  handle: string;
  role: string;
  bio: string;
  goal: string;
  projects: { title: string; role: string; url: string; summary: string }[];
  exampleCorrection: { claim: string; text: string; attribution: "contributor"; attributionNote: string; why: string };
};

export function loadProfile(): ExampleProfile {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "profile.json"), "utf8"));
}

export function loadCv(): string {
  return fs.readFileSync(path.join(ROOT, "cv.md"), "utf8");
}

type Commit = { sha: string; author: string; message: string };

export function detectAuthorship(text: string, who: { handle: string; personName: string }): Authorship | undefined {
  const header = text.split("\n").slice(0, 8).join("\n").toLowerCase();
  const names = [who.handle.toLowerCase(), who.personName.toLowerCase()];
  const m = header.match(/^(?:author|written by):?\s+(.+?)\.?$/m);
  return m && names.includes(m[1]!.trim()) ? "all-by-handle" : undefined;
}

const DOC_ORDER = (f: string) => (f === "README.md" ? 0 : f.startsWith("PR-") ? 2 : 1);

export function fixtureSourcesFor(projectUrl: string, who: { handle: string; personName: string }): FetchedSource[] {
  const m = projectUrl.match(/^example:\/\/rin\/([a-z]+)$/);
  const dir = m ? path.join(ROOT, m[1]!) : null;
  if (!m || !dir || !fs.existsSync(dir)) {
    return [
      {
        url: projectUrl,
        kind: "fixture",
        status: "unavailable",
        statusDetail: "Not in the EXAMPLE fixture set. Fixture mode makes no network calls.",
        locator: "project",
        text: "",
      },
    ];
  }
  const name = m[1]!;
  const commits: Commit[] = JSON.parse(fs.readFileSync(path.join(dir, "commits.json"), "utf8"));
  const counts = new Map<string, number>();
  for (const c of commits) counts.set(c.author, (counts.get(c.author) ?? 0) + 1);
  const meta: GithubMeta = {
    owner: "example-rin",
    repo: name,
    handle: who.handle,
    handleIsOwner: false,
    handleCommitCount: counts.get(who.handle) ?? 0,
    totalCommitsSampled: commits.length,
  };
  const base = { kind: "fixture" as const, status: "ok" as const, statusDetail: "EXAMPLE fixture file (no network)", meta };

  const docs = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort((a, b) => DOC_ORDER(a) - DOC_ORDER(b) || a.localeCompare(b))
    .map((f): FetchedSource => {
      const text = fs.readFileSync(path.join(dir, f), "utf8");
      return { ...base, url: `${projectUrl}/${f}`, locator: f, text, authorship: detectAuthorship(text, who) };
    });

  return [
    ...docs,
    {
      ...base,
      url: `${projectUrl}/commits`,
      locator: "commits",
      text: commits.map((c) => `${c.sha} ${c.author}: ${c.message}`).join("\n"),
      authorship: "line-prefix",
    },
    {
      ...base,
      url: `${projectUrl}/contributors`,
      locator: "contributors",
      text: [...counts].map(([a, n]) => `${a}: ${n} commit${n === 1 ? "" : "s"}`).join("\n"),
    },
  ];
}

export function fixtureIllustration(projectUrl: string): string | null {
  const m = projectUrl.match(/^example:\/\/rin\/([a-z]+)$/);
  if (!m) return null;
  const p = path.join(ROOT, m[1]!, "illustration.svg");
  return fs.existsSync(p) ? `/api/example/${m[1]}/illustration.svg` : null;
}

export type RecordedClaim = {
  text: string;
  kind: ClaimKind;
  attribution: Attribution;
  tags: string[];
  legalFlag: string | null;
  quotes: { source: string; quote: string }[];
};

type Recorded = { label: string; projects: Record<string, { questions: string[]; claims: RecordedClaim[] }> };

export function recordedClaims(projectTitle: string): { label: string; questions: string[]; claims: RecordedClaim[] } {
  const rec: Recorded = JSON.parse(fs.readFileSync(path.join(ROOT, "recorded", "claims.json"), "utf8"));
  const p = rec.projects[projectTitle];
  return { label: rec.label, questions: p?.questions ?? [], claims: p?.claims ?? [] };
}

export function readIllustration(name: string): string | null {
  if (!/^[a-z]+$/.test(name)) return null;
  const p = path.join(ROOT, name, "illustration.svg");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}
