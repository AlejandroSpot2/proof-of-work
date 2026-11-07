import type { Attribution, ClaimKind, ClaimState, Support } from "./types";
import { SUPPORT_RANK } from "./types";
import type { GithubMeta, SourceKind } from "@/lib/ingest/types";

const MIN_QUOTE_CHARS = 12;

/** Only typographic noise is normalized; wording and case must match the source exactly. */
export function normalizeForQuote(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteIsLiteral(quote: string, sourceText: string): boolean {
  const q = normalizeForQuote(quote);
  if (q.length < MIN_QUOTE_CHARS) return false;
  return normalizeForQuote(sourceText).includes(q);
}

export type SourceFacts = {
  id: string;
  url: string;
  kind: SourceKind;
  meta: GithubMeta | null;
};

/** Sources from the same repository or the same host are one origin; corroboration needs two origins. */
export function originOf(source: SourceFacts): string {
  if (source.meta) return `github:${source.meta.owner}/${source.meta.repo}`.toLowerCase();
  try {
    return `${source.kind === "user" ? "self" : "web"}:${new URL(source.url).hostname}`;
  } catch {
    return `${source.kind}:${source.url}`;
  }
}

const AUTHORSHIP: ReadonlySet<Attribution> = new Set(["author", "co_author", "contributor"]);

/**
 * Repo ownership is not authorship. A GitHub source counts as evidence for an authorship claim
 * only when the person has commits in that repository.
 */
export function sourceCanEvidenceAuthorship(source: SourceFacts): boolean {
  if (!source.meta) return true;
  return source.meta.handleCommitCount > 0;
}

export type StateInput = {
  kind: ClaimKind;
  attribution: Attribution;
  origin: "model" | "fixture" | "owner";
  evidenceSources: SourceFacts[];
};

export type StateResult = {
  state: ClaimState;
  attribution: Attribution;
  usableSourceIds: string[];
  heldBack: string | null;
};

export function deriveClaimState(input: StateInput): StateResult {
  const claimsAuthorship =
    (input.kind === "contribution" || input.kind === "impact") && AUTHORSHIP.has(input.attribution);

  let usable = input.evidenceSources;
  let heldBack: string | null = null;
  if (claimsAuthorship) {
    const blocked = usable.filter((s) => !sourceCanEvidenceAuthorship(s));
    usable = usable.filter(sourceCanEvidenceAuthorship);
    if (blocked.length && !usable.length) {
      const m = blocked[0]!.meta!;
      heldBack = `No commits by @${m.handle} in ${m.owner}/${m.repo}. Presence in a repository is not authorship.`;
    }
  }

  const attribution = heldBack ? "unknown" : input.attribution;
  const usableSourceIds = usable.map((s) => s.id);
  if (!usable.length) {
    return {
      state: input.origin === "owner" ? "user_attested" : "unverified",
      attribution,
      usableSourceIds,
      heldBack,
    };
  }

  const independent = usable.filter((s) => s.kind !== "user");
  if (!independent.length) return { state: "user_attested", attribution, usableSourceIds, heldBack };

  const origins = new Set(usable.map(originOf));
  return {
    state: origins.size >= 2 ? "corroborated" : "fetched",
    attribution,
    usableSourceIds,
    heldBack,
  };
}

export type CitedClaim = {
  id: string;
  text: string;
  kind: ClaimKind;
  state: ClaimState;
  attribution: Attribution;
  attributionNote: string | null;
  evidenceLocators: string[];
};

export function isLanguageOnly(c: CitedClaim): boolean {
  return c.evidenceLocators.length > 0 && c.evidenceLocators.every((l) => l === "languages");
}

/** The strongest support level a single approved claim can lend a capability. Computed, never model-chosen. */
export function claimCeiling(c: CitedClaim): Support {
  if (c.state === "unverified") return "unknown";
  if (c.state === "user_attested") return "inferred";
  if (c.kind === "skill" || isLanguageOnly(c)) return "inferred";
  if (c.attribution === "unknown" || c.attribution === "reviewer") return "inferred";
  return "demonstrated";
}

export function supportCeiling(cited: CitedClaim[]): Support {
  return cited.reduce<Support>(
    (best, c) => (SUPPORT_RANK[claimCeiling(c)] > SUPPORT_RANK[best] ? claimCeiling(c) : best),
    "unknown",
  );
}

export function capSupport(proposed: Support, ceiling: Support): Support {
  return SUPPORT_RANK[proposed] <= SUPPORT_RANK[ceiling] ? proposed : ceiling;
}

export function derivedLimits(cited: CitedClaim[]): string[] {
  const out: string[] = [];
  for (const c of cited) {
    if (isLanguageOnly(c)) out.push("Rests on repository language data. A language in a repo is not mastery.");
    else if (c.state === "user_attested") out.push(`Only the builder says this: "${c.text}"`);
    if (c.attribution === "co_author")
      out.push(`Shared work${c.attributionNote ? `: ${c.attributionNote}` : `: "${c.text}" was co-authored`}`);
    if (c.attribution === "contributor") out.push(`Contribution to a project led by others: "${c.text}"`);
    if (c.attribution === "reviewer") out.push(`Reviewed, did not author: "${c.text}"`);
  }
  return [...new Set(out)];
}
