import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { deriveEntrust, loadSnapshot, portfolioView, type ResolvedCapability, type Snapshot } from "@/lib/views/project";
import { opportunitiesFor, type Opportunity } from "@/lib/opportunities";
import { nextStepsFor, type NextStep } from "@/lib/next-steps";
import { attorneyView } from "@/lib/views/project";
import type { Support } from "@/lib/domain/types";
import { loadProfile } from "@/lib/fixtures/rin";

export type ProofItem = { id: string; sourceId: string; quote: string; locator: string; projectTitle: string };
export type Commit = { sha: string; author: string; message: string; date: string | null; mine: boolean };

export type PortfolioProject = {
  id: string;
  slug: string;
  title: string;
  role: string | null;
  summary: string;
  period: string | null;
  contribution: string;
  rinPart: { text: string; shared: boolean; proof: ProofItem[] }[];
  others: { who: string; commits: Commit[] }[];
  rinCommits: Commit[];
  outcome: { text: string; proof: ProofItem[] } | null;
  openQuestion: string | null;
  files: string[];
  proof: ProofItem[];
  documents: { locator: string; title: string; body: string; sourceId: string }[];
};

export type PortfolioCapability = { key: string; name: string; support: Support; projects: string[]; proof: ProofItem[]; limit: string | null };

export type PortfolioModel = {
  example: boolean;
  person: { name: string; firstName: string; handle: string; role: string; headline: string; intro: string; location: string; goal: string | null };
  stats: { projects: number; files: number; statements: number };
  projects: PortfolioProject[];
  capabilities: PortfolioCapability[];
  question: string | null;
  nextBuild: { title: string; summary: string; parts: PortfolioCapability[]; gaps: string[] } | null;
  nextSteps: NextStep[];
  roles: Opportunity[];
  hidden: string[];
  ledgerRevision: number;
  builtAt: number | null;
  /** Owner only: the pasted CV (the "before", never evidence) and where the last build came from. */
  cv: string | null;
  provenance: t.Provenance | null;
};

const COMMIT_LINE = /^(\S+)\s+([^:\s]+):\s+(.*?)(?:\s+\((\d{4}-\d{2}-\d{2})\))?$/;

function parseCommits(text: string, handle: string): Commit[] {
  return text
    .split("\n")
    .map((l) => l.match(COMMIT_LINE))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ sha: m[1]!, author: m[2]!, message: m[3]!, date: m[4] ?? null, mine: m[2]!.toLowerCase() === handle.toLowerCase() }));
}

/** EXAMPLE handles read as names ("contributor-b" → "Contributor B"); real handles keep their @. */
const displayName = (handle: string, example: boolean) =>
  example ? handle.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : `@${handle}`;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

function contributionParagraph(first: string, parts: { text: string; shared: boolean }[], others: { who: string; commits: Commit[] }[]) {
  const mine = parts.map((p) => `${first} ${lowerFirst(sentence(p.text))}`);
  const theirs = others.map((o) => `${o.who} wrote ${o.commits.length === 1 ? "one change" : `${o.commits.length} changes`} here: ${o.commits.map((c) => lowerFirst(c.message)).join("; ")}.`);
  return [...mine, ...theirs].join(" ");
}

const proofOf = (c: { evidence: { id: string; sourceId: string; quote: string; locator: string }[] }, projectTitle: string): ProofItem[] =>
  c.evidence.map((e) => ({ id: e.id, sourceId: e.sourceId, quote: e.quote, locator: e.locator, projectTitle }));

const capOf = (c: ResolvedCapability): PortfolioCapability => ({
  key: c.key,
  name: c.name,
  support: c.support,
  projects: [...new Set(c.claims.map((x) => x.projectTitle))],
  proof: c.evidence.map((e) => ({ id: e.id, sourceId: e.sourceId, quote: e.quote, locator: e.locator, projectTitle: e.projectTitle })),
  limit: c.limits[0] ?? null,
});

/** One portfolio model from the confirmed, publishable statements. The Studio preview and the shared link render the same model. */
export function buildPortfolio(db: Db, workspaceId: string, opts: { audience: "owner" | "public" }): PortfolioModel | null {
  const snap: Snapshot | null = loadSnapshot(db, workspaceId);
  if (!snap) return null;
  const ws = snap.workspace;
  const settings = ws.portfolioSettings ?? {};
  const example = ws.mode === "fixture";
  const profile = example ? loadProfile() : null;
  const first = ws.personName.replace(/\s*\(EXAMPLE\)\s*/, "").split(" ")[0] ?? ws.personName;
  const view = portfolioView(snap);
  const entrust = deriveEntrust(snap);

  const commitSources = snap.projects.flatMap((p) =>
    p.sources.filter((s) => s.status === "ok" && (s.locator.startsWith("commits") || (/\.md$/i.test(s.locator) && !/^README/i.test(s.locator)))).map((s) => s.id),
  );
  const texts = commitSources.length ? db.select().from(t.sources).where(inArray(t.sources.id, commitSources)).all() : [];

  const projects: PortfolioProject[] = snap.projects
    .map((p) => {
      const pub = view.projects.find((x) => x.title === p.title);
      const claims = p.claims.filter((c) => c.reviewStatus === "approved" && (opts.audience === "owner" || c.publishable));
      const commitText = texts.filter((s) => s.projectId === p.id && s.locator.startsWith("commits")).map((s) => s.snippetStore).join("\n");
      const documents = texts
        .filter((s) => s.projectId === p.id && /\.md$/i.test(s.locator))
        .sort((a, b) => Number(!a.locator.startsWith("PR-")) - Number(!b.locator.startsWith("PR-")))
        .map((s) => {
          const [head, ...rest] = s.snippetStore.trim().split("\n");
          const body = rest.filter((l) => !/^\s*```/.test(l)).join("\n").trim().slice(0, 1400);
          return { locator: s.locator, title: (head ?? s.locator).replace(/^#+\s*/, ""), body, sourceId: s.id };
        });
      const commits = parseCommits(commitText, ws.githubHandle);
      const otherMap = new Map<string, Commit[]>();
      for (const c of commits.filter((c) => !c.mine)) {
        const who = displayName(c.author, example);
        otherMap.set(who, [...(otherMap.get(who) ?? []), { ...c, author: who }]);
      }
      const others = [...otherMap].map(([who, cs]) => ({ who, commits: cs }));
      const dates = commits.map((c) => c.date).filter((d): d is string => !!d).sort();
      const rinPart = claims
        .filter((c) => c.kind !== "impact")
        .map((c) => ({ text: c.text, shared: c.attribution !== "author", proof: proofOf(c, p.title) }));
      const outcomeClaim = claims.find((c) => c.kind === "impact");
      const meta = profile?.projects.find((x) => x.title === p.title);
      void pub;
      return {
        id: p.id,
        slug: p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: p.title,
        role: p.role,
        summary: meta?.summary ?? "",
        period: dates.length ? `${fmtMonth(dates[0]!)} – ${fmtMonth(dates[dates.length - 1]!)}` : null,
        contribution: contributionParagraph(first, rinPart, others),
        rinPart,
        others,
        rinCommits: commits.filter((c) => c.mine),
        outcome: outcomeClaim ? { text: outcomeClaim.text, proof: proofOf(outcomeClaim, p.title) } : null,
        openQuestion: p.questions[0] ?? null,
        files: p.sources.filter((s) => s.status === "ok").map((s) => s.locator),
        proof: claims.flatMap((c) => proofOf(c, p.title)),
        documents,
      };
    })
    .filter((p) => opts.audience === "owner" || !(settings.hidden ?? []).includes(p.slug));

  const caps = (opts.audience === "owner" ? entrust.capabilities : view.capabilities).map(capOf);
  const opportunities = example ? opportunitiesFor(entrust) : [];
  const steps = nextStepsFor(entrust, opportunities, attorneyView(snap).questions.length, first);
  const nb = opts.audience === "owner" ? entrust.nextBuild : view.nextBuild;

  return {
    example,
    person: {
      name: ws.personName,
      firstName: first,
      handle: ws.githubHandle,
      role: profile?.role ?? "",
      headline: settings.headline?.trim() || profile?.headline || caps.filter((c) => c.support === "demonstrated").map((c) => c.name).join(". ") || ws.personName,
      intro: settings.intro?.trim() || profile?.intro || "",
      location: profile?.location ?? "",
      goal: entrust.goal,
    },
    stats: {
      projects: projects.length,
      files: snap.projects.flatMap((p) => p.sources).filter((s) => s.status === "ok").length,
      statements: snap.projects.flatMap((p) => p.claims).filter((c) => c.reviewStatus === "approved").length,
    },
    projects,
    capabilities: caps,
    question: entrust.question,
    nextBuild: nb ? { title: nb.title, summary: nb.summary, parts: nb.parts.map(capOf), gaps: nb.gaps } : null,
    nextSteps: steps,
    roles: opportunities,
    hidden: settings.hidden ?? [],
    ledgerRevision: ws.ledgerRevision,
    builtAt: settings.builtAt ?? null,
    cv: opts.audience === "owner" ? (settings.cv ?? null) : null,
    provenance: opts.audience === "owner" ? (settings.provenance ?? null) : null,
  };
}

function fmtMonth(iso: string) {
  const [y, m] = iso.split("-");
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]} ${y}`;
}

export function updatePortfolioSettings(db: Db, workspaceId: string, patch: { headline?: string; intro?: string; hidden?: string[]; builtAt?: number; cv?: string; provenance?: t.Provenance }) {
  const ws = db.select().from(t.workspaces).where(eq(t.workspaces.id, workspaceId)).get();
  if (!ws) return;
  const next = { ...(ws.portfolioSettings ?? {}), ...patch };
  if (next.headline !== undefined) next.headline = next.headline.slice(0, 140);
  if (next.intro !== undefined) next.intro = next.intro.slice(0, 400);
  if (next.cv !== undefined) next.cv = next.cv.slice(0, 6000);
  db.update(t.workspaces).set({ portfolioSettings: next }).where(eq(t.workspaces.id, workspaceId)).run();
}
