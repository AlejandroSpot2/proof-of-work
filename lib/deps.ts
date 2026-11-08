import type { Deps } from "@/lib/workspace";
import type { Mode } from "@/lib/domain/types";
import type { FetchedSource } from "@/lib/ingest/types";
import { fixtureSourcesFor, detectAuthorship, EXAMPLE_SCHEME } from "@/lib/fixtures/rin";
import { proposeClaimsFromRecording, proposeClaimsWithModel } from "@/lib/claims/propose";
import { inferWithFixtureRules } from "@/lib/capabilities/fixture-engine";
import { inferWithModel } from "@/lib/capabilities/infer";
import { checkUrl, defaultAllowlist } from "@/lib/ingest/url";
import { fetchGithubProject, parseGithubRepoUrl } from "@/lib/ingest/github";
import { fetchWebSource } from "@/lib/ingest/web";
import { translateWithDictionary, translateWithModel } from "@/lib/translate";
import { extractByRules, extractWithModel } from "@/lib/requirements";
import { fixtureDiscover, tregDiscover } from "@/lib/discover-live";

const blocked = (url: string, reason: string): FetchedSource => ({ url, kind: "web", status: "blocked", statusDetail: reason, locator: "page", text: "" });

export const fixtureDeps: Deps = {
  async fetchSources(url, _ownPage, _all, who) {
    if (!url.startsWith(EXAMPLE_SCHEME)) {
      return [{ url, kind: "web", status: "unavailable", statusDetail: "Fixture mode makes no network calls. Use live mode for real URLs.", locator: "page", text: "" }];
    }
    return fixtureSourcesFor(url, who);
  },
  async proposeClaims({ projectTitle, sources }) {
    return proposeClaimsFromRecording(projectTitle, sources);
  },
  async inferCapabilities(goal, claims) {
    return { proposal: inferWithFixtureRules(goal, claims), engine: "fixture rules (no model)" };
  },
  translate: (texts) => translateWithDictionary(texts),
  extractRequirements: (posting) => extractByRules(posting),
  discover: fixtureDiscover,
  now: () => Date.now(),
};

export const liveDeps: Deps = {
  async fetchSources(url, ownPage, allUrls, who) {
    const allowlist = defaultAllowlist(allUrls);
    const check = checkUrl(url, allowlist);
    if (!check.ok) return [blocked(url, check.reason)];
    if (parseGithubRepoUrl(url)) {
      const sources = await fetchGithubProject({ url, handle: who.handle, token: process.env.GITHUB_TOKEN || undefined });
      return sources.map((s) => (s.locator.startsWith("commits by @") ? { ...s, authorship: "all-by-handle" as const } : s));
    }
    const s = await fetchWebSource(url, allowlist);
    return [{ ...s, kind: ownPage ? "user" : "web", authorship: detectAuthorship(s.text, who) }];
  },
  async proposeClaims({ projectTitle, role, who, sources }) {
    return proposeClaimsWithModel({ projectTitle, role, personName: who.personName, handle: who.handle, sources });
  },
  async inferCapabilities(goal, claims) {
    return inferWithModel(goal, claims);
  },
  translate: (texts) => translateWithModel(texts),
  extractRequirements: (posting) => extractWithModel(posting),
  discover: tregDiscover(),
  now: () => Date.now(),
};

export const depsFor = (mode: Mode): Deps => (mode === "fixture" ? fixtureDeps : liveDeps);
