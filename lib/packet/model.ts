import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { attorneyView, loadSnapshot, type Snapshot } from "@/lib/views/project";
import { loadProfile, readIllustration } from "@/lib/fixtures/rin";
import type { ClaimKind, ClaimState } from "@/lib/domain/types";

/** How strongly the record backs a statement or an exhibit. Repository records are never called independent. */
export type Classification = "Independent" | "Repository record" | "Self-attested" | "Unverified";

export const CLASSIFICATION_OF: Record<ClaimState, Classification> = {
  corroborated: "Independent",
  fetched: "Repository record",
  user_attested: "Self-attested",
  unverified: "Unverified",
};

export const CLASSIFICATION_MEANING: Record<Exclude<Classification, "Unverified">, string> = {
  Independent: "Backed by files from two independent origins.",
  "Repository record": "A file in the project's own repository that is Rin's by its own content: her commit lines, or a note or pull request whose header names her.",
  "Self-attested": "Rests on Rin's own word. No file says it.",
};

export type PageMap = Record<string, number>;

export type ExhibitId = `E-${string}`;

/** A pointer from a statement or a row to one passage of one exhibit. */
export type Citation = { exhibitId: ExhibitId; line: number; quote: string };

export type Statement = {
  id: string;
  text: string;
  kind: ClaimKind;
  classification: Classification;
  shared: boolean;
  attributionNote: string | null;
  citations: Citation[];
};

export type OthersWork = { who: string; date: string | null; what: string; citation: Citation };

export type PacketProject = {
  anchor: string;
  title: string;
  role: string | null;
  summary: string | null;
  rinScope: string;
  statements: Statement[];
  others: OthersWork[];
  fileStatements: Citation[];
  exhibitIds: ExhibitId[];
};

/** "statement": the passage backs one of Rin's statements. "context": cited for others' work, a date or a stated limit. */
export type MarkKind = "statement" | "context";
export type Mark = { start: number; end: number; kind: MarkKind };
export type ExcerptLine = { n: number; text: string; marks: Mark[] } | { gap: true };

export type Exhibit = {
  id: ExhibitId;
  anchor: string;
  title: string;
  project: string;
  locator: string;
  url: string;
  contentHash: string;
  retrieved: string;
  classification: Classification;
  authorship: string;
  quotes: string[];
  citedBy: string[];
  excerpt: ExcerptLine[];
  fullText: boolean;
  illustration: { svg: string; caption: string } | null;
};

export type ChronoRow = { date: string; project: string; who: string; isRin: boolean; event: string; citation: Citation };

export type Outcome = { project: string; text: string; citation: Citation };

export type Gap = { priority: "High" | "Medium" | "Low"; title: string; reason: string };

export type Packet = {
  example: boolean;
  workspaceId: string;
  ledgerRevision: number;
  generated: string;
  person: { name: string; handle: string; role: string | null; bio: string | null; location: string | null; goal: string | null };
  summary: { statements: number; byClass: Record<Classification, number>; shared: number; exhibits: number; projects: number; shows: string[]; doesNotShow: string[] };
  projects: PacketProject[];
  outcomes: Outcome[];
  limits: string[];
  chronology: ChronoRow[];
  exhibits: Exhibit[];
  gaps: Gap[];
  questions: string[];
};

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const TAG_WORDS: Record<string, string> = {
  docs: "documentation",
  releases: "the release process",
  sync: "sync",
  "conflict-resolution": "conflict resolution",
  offline: "offline editing",
  "event-sourcing": "event replay",
  performance: "benchmarking",
  ai: "AI-assisted drafting",
  "structured-outputs": "schema-validated output",
  "prompt-injection": "prompt-injection defense",
  security: "",
  product: "issue ranking",
  prioritization: "",
};

const FILE_ORDER = (locator: string) =>
  locator === "README.md" ? 0 : locator === "commits" ? 3 : locator === "contributors" ? 4 : locator.startsWith("PR-") ? 2 : 1;

const COMMIT_LINE = /^([0-9a-f]{7,40}) ([^:]+): (.*?)(?: \((\d{4}-\d{2}-\d{2})\))?$/;

type SourceRow = typeof t.sources.$inferSelect;

/** Recolors a fixture illustration into the packet's ink-on-paper palette; the files themselves are left as they are. */
function inkIllustration(svg: string): string {
  const swaps: [RegExp, string][] = [
    [/#e1dfd9/gi, "#f4f4f1"],
    [/#f3f3f1/gi, "#ffffff"],
    [/#38450f/gi, "#0e1116"],
    [/#2a340b/gi, "#0e1116"],
    [/#5d683a/gi, "#565c68"],
    [/Switzer, Arial, sans-serif/g, "Geist, Arial, sans-serif"],
    [/EXAMPLE illustration/g, "Concept illustration, synthetic"],
  ];
  return swaps.reduce((s, [re, to]) => s.replace(re, to), svg);
}

function titleOf(src: SourceRow, project: string): string {
  if (src.locator === "commits") return `${project} commit log`;
  if (src.locator === "contributors") return `${project} contributors and commit counts`;
  if (src.locator === "README.md") return `${project} README`;
  const h = src.snippetStore.match(/^#\s+(.+)$/m)?.[1]?.replace(/\s*\(EXAMPLE\)\s*$/, "").trim();
  return h ? (h.toLowerCase().startsWith(project.toLowerCase()) ? h : `${project}: ${h}`) : `${project} ${src.locator}`;
}

function authorshipOf(src: SourceRow, handle: string): string {
  if (src.locator === "contributors") return "Commit counts per author, derived from the commit log.";
  if (src.authorship === "line-prefix") return `Commit log. Lines prefixed "${handle}:" are Rin's; other lines are other people's.`;
  if (src.authorship === "all-by-handle") return "The file's header names Rin as its author.";
  return "Project file. It does not name its author, so it backs context, not Rin's authorship.";
}

/** Finds each quote in the source line by line, literally. Quotes in fixtures sit on one line. */
function locate(text: string, quote: string): { line: number; start: number } | null {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i]!.indexOf(quote);
    if (start >= 0) return { line: i + 1, start };
  }
  return null;
}

const FULL_TEXT_LINES = 48;

function excerptOf(text: string, quotes: Map<string, MarkKind>): { lines: ExcerptLine[]; full: boolean } {
  const lines = text.replace(/\s+$/, "").split("\n");
  const marks = new Map<number, Mark[]>();
  for (const [q, kind] of quotes) {
    const at = locate(text, q);
    if (!at) continue;
    const mine = (marks.get(at.line) ?? []).filter((m) => !(m.start <= at.start && m.end >= at.start + q.length && m.kind === "context"));
    if (mine.some((m) => m.start <= at.start && m.end >= at.start + q.length)) continue;
    marks.set(at.line, [...mine, { start: at.start, end: at.start + q.length, kind }]);
  }
  const row = (i: number): ExcerptLine => ({ n: i + 1, text: lines[i]!, marks: (marks.get(i + 1) ?? []).sort((a, b) => a.start - b.start) });
  if (lines.length <= FULL_TEXT_LINES) return { lines: lines.map((_, i) => row(i)), full: true };
  const keep = new Set<number>();
  for (const n of marks.keys()) for (let i = n - 4; i <= n + 2; i++) if (i >= 0 && i < lines.length) keep.add(i);
  const out: ExcerptLine[] = [];
  let last = -1;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (i !== last + 1) out.push({ gap: true });
    out.push(row(i));
    last = i;
  }
  if (last < lines.length - 1) out.push({ gap: true });
  return { lines: out, full: false };
}

const RESULT_LINE = /\b(synthetic benchmark|synthetic eval|evaluated only|tested only|never run in production|quality on real)/i;

export function buildPacket(db: Db, workspaceId: string, now = Date.now()): Packet | null {
  const snap = loadSnapshot(db, workspaceId);
  if (!snap) return null;
  const view = attorneyView(snap);
  const example = snap.workspace.mode === "fixture";
  const profile = example ? loadProfile() : null;
  const handle = snap.workspace.githubHandle;

  const rows = new Map<string, SourceRow>();
  const sourceRow = (id: string) => {
    if (!rows.has(id)) rows.set(id, db.select().from(t.sources).where(eq(t.sources.id, id)).get()!);
    return rows.get(id)!;
  };

  const approved = (p: Snapshot["projects"][number]) => p.claims.filter((c) => c.reviewStatus === "approved");

  const included = (p: Snapshot["projects"][number]) => {
    const cited = new Set(approved(p).flatMap((c) => c.evidence.map((e) => e.sourceId)));
    return p.sources
      .filter((s) => s.status === "ok" && (cited.has(s.id) || s.locator === "contributors" || (s.locator.startsWith("PR-") && /^Merged:/m.test(sourceRow(s.id).snippetStore))))
      .sort((a, b) => FILE_ORDER(a.locator) - FILE_ORDER(b.locator) || a.locator.localeCompare(b.locator));
  };

  const exhibitOfSource = new Map<string, ExhibitId>();
  let n = 0;
  for (const p of snap.projects) for (const s of included(p)) exhibitOfSource.set(s.id, `E-${String(++n).padStart(2, "0")}`);

  const cite = (sourceId: string, quote: string): Citation => {
    const at = locate(sourceRow(sourceId).snippetStore, quote);
    return { exhibitId: exhibitOfSource.get(sourceId)!, line: at?.line ?? 0, quote };
  };

  const quotesBySource = new Map<string, Map<string, MarkKind>>();
  const citedBy = new Map<string, string[]>();
  const addQuote = (sourceId: string, quote: string, by?: string) => {
    const qs = quotesBySource.get(sourceId) ?? new Map<string, MarkKind>();
    if (qs.get(quote) !== "statement") qs.set(quote, by ? "statement" : "context");
    quotesBySource.set(sourceId, qs);
    if (by) citedBy.set(sourceId, [...new Set([...(citedBy.get(sourceId) ?? []), by])]);
  };

  const chronology: ChronoRow[] = [];
  const outcomes: Outcome[] = [];

  const projects: PacketProject[] = snap.projects.map((p) => {
    const statements: Statement[] = approved(p).map((c) => {
      for (const e of c.evidence) addQuote(e.sourceId, e.quote, c.text);
      return {
        id: c.id,
        text: c.text,
        kind: c.kind,
        classification: CLASSIFICATION_OF[c.state],
        shared: c.attribution === "co_author" || c.attribution === "contributor",
        attributionNote: c.attributionNote,
        citations: c.evidence.map((e) => cite(e.sourceId, e.quote)),
      };
    });

    const others: OthersWork[] = [];
    const fileStatements: Citation[] = [];
    for (const s of included(p)) {
      const text = sourceRow(s.id).snippetStore;
      if (s.locator === "commits") {
        for (const line of text.split("\n")) {
          const m = line.match(COMMIT_LINE);
          if (!m) continue;
          const [, sha, who, message, date] = m;
          const isRin = who === handle;
          if (date) chronology.push({ date, project: p.title, who: who!, isRin, event: `Commit ${sha}: ${message}`, citation: cite(s.id, line) });
          if (!isRin) {
            addQuote(s.id, line);
            others.push({ who: who!, date: date ?? null, what: message!, citation: cite(s.id, line) });
          }
        }
      } else if (s.locator.startsWith("PR-")) {
        const merged = text.match(/^Merged:\s*(\d{4}-\d{2}-\d{2})\s*$/m);
        const author = text.match(/^Author:\s*(\S+)\s*$/m)?.[1] ?? "unknown";
        const reviewer = text.match(/^Reviewer:\s*(\S+)\s*$/m)?.[1];
        const title = text.match(/^#\s+(.+?)(?:\s*\(EXAMPLE\))?\s*$/m)?.[1] ?? s.locator;
        if (merged) {
          addQuote(s.id, merged[0].trim());
          chronology.push({ date: merged[1]!, project: p.title, who: author, isRin: author === handle, event: `Merged ${title}`, citation: cite(s.id, merged[0].trim()) });
        }
        if (reviewer && reviewer !== handle) {
          const line = `Reviewer: ${reviewer}`;
          addQuote(s.id, line);
          others.push({ who: reviewer, date: merged?.[1] ?? null, what: `Reviewed ${title}`, citation: cite(s.id, line) });
        }
      } else if (s.locator !== "contributors") {
        for (const line of text.split("\n")) {
          if (/\bContributor [A-Z]\b/.test(line)) {
            const said = line.replace(/^\s*[-*]\s+/, "").trim();
            addQuote(s.id, said);
            fileStatements.push(cite(s.id, said));
          }
        }
      }
      if (s.locator !== "commits" && s.locator !== "contributors") {
        for (const line of text.split("\n")) {
          if (RESULT_LINE.test(line)) {
            addQuote(s.id, line.trim());
            outcomes.push({ project: p.title, text: line.trim(), citation: cite(s.id, line.trim()) });
          }
        }
      }
    }

    others.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const tags = [...new Set(approved(p).filter((c) => c.attribution !== "unknown").flatMap((c) => c.tags))];
    const words = [...new Set(tags.map((tag) => TAG_WORDS[tag] ?? tag.replace(/-/g, " ")))].filter(Boolean);
    const otherNames = [...new Set(others.filter((o) => !o.what.startsWith("Reviewed")).map((o) => o.who))];
    const rinScope =
      `Rin's part in this record: ${words.join(", ") || "not stated"}.` +
      (otherNames.length ? ` Commits by ${otherNames.join(" and ")} are listed below as others' work and are not claimed as Rin's.` : "");

    return {
      anchor: `proj-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: p.title,
      role: p.role,
      summary: profile?.projects.find((x) => x.title === p.title)?.summary ?? null,
      rinScope,
      statements,
      others,
      fileStatements,
      exhibitIds: included(p).map((s) => exhibitOfSource.get(s.id)!),
    };
  });

  chronology.sort((a, b) => a.date.localeCompare(b.date) || a.project.localeCompare(b.project));

  const exhibits: Exhibit[] = snap.projects.flatMap((p) =>
    included(p).map((s, i): Exhibit => {
      const row = sourceRow(s.id);
      const quoted = quotesBySource.get(s.id) ?? new Map<string, MarkKind>();
      const quotes = [...quoted.keys()];
      const { lines, full } = excerptOf(row.snippetStore, quoted);
      const name = p.title.toLowerCase();
      const svg = i === 0 && example ? readIllustration(name) : null;
      const id = exhibitOfSource.get(s.id)!;
      return {
        id,
        anchor: `ex-${id}`,
        title: titleOf(row, p.title),
        project: p.title,
        locator: s.locator,
        url: s.url,
        contentHash: s.contentHash,
        retrieved: ymd(s.fetchedAt),
        classification: "Repository record",
        authorship: authorshipOf(row, handle),
        quotes,
        citedBy: citedBy.get(s.id) ?? [],
        excerpt: lines,
        fullText: full,
        illustration: svg
          ? {
              svg: inkIllustration(svg),
              caption:
                `Concept illustration, synthetic. Drawn for this example to show what ${p.title} does; it is not a screenshot and not evidence.` +
                ((builders) => (builders.length ? ` It shows the whole project, including parts built by ${builders.join(" and ")}.` : ""))([
                  ...new Set(projects.find((x) => x.title === p.title)!.others.filter((o) => !o.what.startsWith("Reviewed")).map((o) => o.who)),
                ]),
            }
          : null,
      };
    }),
  );

  const all = projects.flatMap((p) => p.statements);
  const byClass: Record<Classification, number> = { Independent: 0, "Repository record": 0, "Self-attested": 0, Unverified: 0 };
  for (const s of all) byClass[s.classification]++;
  const shared = all.filter((s) => s.shared);
  const unknownCaps = view.capabilities.filter((c) => c.support === "unknown");
  const synthetic = outcomes.filter((o) => /synthetic/i.test(o.text));

  const shows = [
    `${all.length} confirmed statements about Rin's work across ${projects.length} projects, each tied to a literal passage in a file.`,
    ...(shared.length
      ? [`${shared.length} of them describe shared work; the people who did the rest are named from the commit log.`]
      : []),
    `${chronology.length} dated events from commit logs and merged pull requests, from ${chronology[0]?.date ?? "unknown"} to ${chronology.at(-1)?.date ?? "unknown"}.`,
  ];
  const doesNotShow = [
    ...(byClass.Independent === 0 ? ["No statement is backed by an independent origin. Every exhibit is a file in a repository where Rin committed."] : []),
    ...view.gaps,
    ...(synthetic.length ? ["Results are measured on synthetic data only; they are stated with that limit below."] : []),
  ];

  const gaps: Gap[] = [];
  if (byClass.Independent === 0)
    gaps.push({
      priority: "High",
      title: "No independent third-party source for any contribution",
      reason: "All exhibits are repository records from projects where Rin committed. None comes from a second, independent origin.",
    });
  for (const c of unknownCaps)
    gaps.push({ priority: "High", title: "No production or real-user evidence", reason: c.limits[0] ?? `Nothing in the files shows: ${c.name}.` });
  for (const p of projects.filter((x) => x.statements.some((s) => s.shared)))
    gaps.push({
      priority: "Medium",
      title: `${p.title}: the split of shared work rests partly on Rin's own description`,
      reason: "A project file names the maintainers but not who owns what. The split rests on commit author lines and Rin's account.",
    });
  if (synthetic.length)
    gaps.push({
      priority: "Medium",
      title: "Benchmarks and evaluations are synthetic",
      reason: `${[...new Set(synthetic.map((o) => o.project))]
        .map((pr) => `${pr} (Ex. ${[...new Set(synthetic.filter((o) => o.project === pr).map((o) => o.citation.exhibitId))].join(", ")})`)
        .join("; ")}: measured on synthetic data, not on real use.`,
    });
  const reviewers = [...new Set(projects.flatMap((p) => p.others.filter((o) => o.what.startsWith("Reviewed")).map((o) => o.who)))];
  if (reviewers.length)
    gaps.push({
      priority: "Low",
      title: "Reviewers appear only as handles",
      reason: `${reviewers.join(", ")} reviewed Rin's pull requests, but the record holds nothing written by them about her work.`,
    });
  gaps.push({
    priority: "Low",
    title: "Dates come from repository metadata",
    reason: "Commit and merge dates are recorded by the repository itself and have no outside timestamp.",
  });

  const questions = [
    ...view.questions,
    ...projects
      .filter((p) => p.others.length && p.statements.some((s) => s.shared))
      .map((p) => `On ${p.title}, others built parts Rin did not. How should her part be presented next to theirs?`),
    "Which corroboration, if any, should Rin look for first: a reviewer's own account, release records, or records of real use?",
    ...(synthetic.length ? ["Should results measured on synthetic data be included at all, and with what wording?"] : []),
    "In what form should the source files be kept for your review: exports, archived links or copies with their content hashes?",
  ];

  return {
    example,
    workspaceId,
    ledgerRevision: snap.workspace.ledgerRevision,
    generated: ymd(now),
    person: {
      name: snap.workspace.personName,
      handle,
      role: profile?.role ?? null,
      bio: profile?.bio ?? null,
      location: (profile as { location?: string } | null)?.location ?? null,
      goal: snap.goal?.text ?? profile?.goal ?? null,
    },
    summary: { statements: all.length, byClass, shared: shared.length, exhibits: exhibits.length, projects: projects.length, shows, doesNotShow },
    projects,
    outcomes,
    limits: view.gaps,
    chronology,
    exhibits,
    gaps,
    questions,
  };
}
