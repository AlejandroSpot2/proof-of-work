import type { Attribution, ClaimKind, ClaimState, Support } from "./types";
import { SUPPORT_RANK } from "./types";
import type { Authorship, GithubMeta, SourceKind } from "@/lib/ingest/types";

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
  text: string;
  meta: GithubMeta | null;
  authorship: Authorship | null;
};

export type Identity = { handle: string; personName: string };

/** Sources from the same repository or the same host are one origin; corroboration needs two origins. */
export function originOf(source: SourceFacts): string {
  if (source.meta) return `repo:${source.meta.owner}/${source.meta.repo}`.toLowerCase();
  try {
    const u = new URL(source.url);
    return `${source.kind === "user" ? "self" : "web"}:${u.hostname}`;
  } catch {
    return `${source.kind}:${source.url}`;
  }
}

function mentions(text: string, who: Identity): boolean {
  const t = text.toLowerCase();
  const name = who.personName.replace(/\s*\(EXAMPLE\)\s*/i, "").trim().toLowerCase();
  const handle = who.handle.toLowerCase();
  return (name.length > 2 && t.includes(name)) || new RegExp(`(^|[^a-z0-9-])@?${handle}([^a-z0-9-]|$)`).test(t);
}

/**
 * Repo ownership is not authorship, and commits are contribution signals, not exclusive authorship.
 * Inside a repository, a quote backs authorship only when it is a line the person wrote (their commit,
 * their PR or notes). Owner lines, contributor counts and READMEs that name them do not. Outside a
 * repository, a page that names them can. A repository where they have no commits never backs authorship.
 */
export function quoteBacksAuthorship(quote: string, source: SourceFacts, who: Identity): boolean {
  if (source.meta && source.meta.handleCommitCount === 0) return false;
  if (source.authorship === "all-by-handle") return true;
  if (source.authorship === "line-prefix") {
    const q = normalizeForQuote(quote);
    const line = source.text.split("\n").find((l) => normalizeForQuote(l).includes(q));
    const author = line?.match(/^\s*\S+\s+([^:\s]+):/)?.[1];
    return !!author && author.toLowerCase() === who.handle.toLowerCase();
  }
  if (source.meta) return false;
  return mentions(quote, who);
}

const AUTHORSHIP: ReadonlySet<Attribution> = new Set(["author", "co_author", "contributor"]);

export function claimsAuthorship(kind: ClaimKind, attribution: Attribution): boolean {
  return (kind === "contribution" || kind === "impact") && AUTHORSHIP.has(attribution);
}

export type QuotedSource = { source: SourceFacts; quote: string };

export type StateResult = {
  state: ClaimState;
  attribution: Attribution;
  backing: boolean[];
  heldBack: string | null;
};

export function deriveClaimState(input: {
  kind: ClaimKind;
  attribution: Attribution;
  origin: "model" | "fixture" | "owner";
  quotes: QuotedSource[];
  who: Identity;
}): StateResult {
  const needsAuthor = claimsAuthorship(input.kind, input.attribution);
  const backing = input.quotes.map((q) => !needsAuthor || quoteBacksAuthorship(q.quote, q.source, input.who));
  const usable = input.quotes.filter((_, i) => backing[i]).map((q) => q.source);

  if (!usable.length) {
    const heldBack =
      needsAuthor && input.quotes.length
        ? `No commit, pull request or source naming @${input.who.handle} backs this. Presence in a repository is not authorship.`
        : null;
    return {
      state: input.origin === "owner" ? "user_attested" : "unverified",
      attribution: heldBack ? "unknown" : input.attribution,
      backing,
      heldBack,
    };
  }
  if (!usable.some((s) => s.kind !== "user")) return { state: "user_attested", attribution: input.attribution, backing, heldBack: null };
  const origins = new Set(usable.map(originOf));
  return { state: origins.size >= 2 ? "corroborated" : "fetched", attribution: input.attribution, backing, heldBack: null };
}

export type CitedClaim = {
  id: string;
  text: string;
  kind: ClaimKind;
  state: ClaimState;
  attribution: Attribution;
  attributionNote: string | null;
  revision: number;
  evidenceLocators: string[];
};

export function isLanguageOnly(c: CitedClaim): boolean {
  return c.evidenceLocators.length > 0 && c.evidenceLocators.every((l) => l === "languages");
}

/** The strongest support a single approved claim can lend a capability. Computed from the ledger, never chosen by a model. */
export function claimCeiling(c: CitedClaim): Support {
  if (c.state === "unverified") return "unknown";
  if (c.state === "user_attested") return "inferred";
  if (c.kind === "skill" || isLanguageOnly(c)) return "inferred";
  if (c.attribution === "unknown" || c.attribution === "reviewer") return "inferred";
  return "demonstrated";
}

export function supportCeiling(cited: CitedClaim[]): Support {
  return cited.reduce<Support>((best, c) => {
    const s = claimCeiling(c);
    return SUPPORT_RANK[s] > SUPPORT_RANK[best] ? s : best;
  }, "unknown");
}

export function capSupport(proposed: Support, ceiling: Support): Support {
  return SUPPORT_RANK[proposed] <= SUPPORT_RANK[ceiling] ? proposed : ceiling;
}

export function derivedLimits(cited: CitedClaim[]): string[] {
  const out: string[] = [];
  for (const c of cited) {
    if (isLanguageOnly(c)) out.push("Rests on repository language data. A language in a repo is not mastery.");
    if (c.state === "user_attested")
      out.push(
        c.revision > 1
          ? `Corrected by the builder: the files back the earlier wording, so this now rests on the builder's word.`
          : `Only the builder says this: "${c.text}"`,
      );
    if (c.kind === "skill") out.push(`A described practice, not a shipped result: "${c.text}"`);
    if (c.attribution === "co_author") out.push(`Shared work${c.attributionNote ? `. ${c.attributionNote}` : `: "${c.text}"`}`);
    if (c.attribution === "contributor")
      out.push(`Contribution to work led by others${c.attributionNote ? `. ${c.attributionNote}` : ""}`);
    if (c.attribution === "reviewer") out.push(`Reviewed, did not author: "${c.text}"`);
  }
  return [...new Set(out)];
}
