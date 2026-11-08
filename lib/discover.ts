import signalsJson from "@/fixtures/example-rin/discover/signals.json";
import type { PortfolioModel } from "@/lib/portfolio";
import type { Localized } from "@/lib/i18n";
import { mentions } from "@/lib/match";
import { backingOf, cofounderPlan, evidenced, poolOf, EXAMPLE_COFOUNDER, type Backing, type CofounderFixture } from "@/lib/next-paths";

/** A fixed EXAMPLE rubric over a prepared list: whether a signal is kept is computed from the portfolio, never stored. */

export type View = "cofounders" | "clients";
export const VIEWS: View[] = ["cofounders", "clients"];
export type Filters = { skills: string[]; needs: string[]; location: string | null };
export const NO_FILTERS: Filters = { skills: [], needs: [], location: null };

export type Reason =
  | { kind: "intent"; words: string[] }
  | { kind: "intent-miss" }
  | { kind: "evidence"; backing: Backing[] }
  | { kind: "evidence-miss"; wants: Localized; notShown: string[] }
  | { kind: "complement"; covers: string[] }
  | { kind: "complement-overlap"; already: string[] }
  | { kind: "complement-miss" }
  | { kind: "filters" }
  | { kind: "filter-skill" }
  | { kind: "filter-need" }
  | { kind: "filter-location"; location: string | null };

type ReasonOf = {
  intent: Extract<Reason, { kind: "intent" | "intent-miss" }>;
  evidence: Extract<Reason, { kind: "evidence" | "evidence-miss" }>;
  complement: Extract<Reason, { kind: "complement" | "complement-overlap" | "complement-miss" }>;
  filters: Extract<Reason, { kind: "filters" | "filter-skill" | "filter-need" | "filter-location" }>;
};
export type CheckId = keyof ReasonOf;
export type Check = { [K in CheckId]: { id: K; pass: boolean; reason: ReasonOf[K] } }[CheckId];

/** Where a live signal came from. Prepared EXAMPLE signals have none. The date is the source's own, never the fetch time. */
export type Origin = { kind: "profile" | "post"; url: string; provider: string; date: string | null };

type Person = CofounderFixture["person"];
type Common = {
  id: string;
  source: Localized;
  recency: Localized;
  quote: string;
  quoteEs: string;
  location: string | null;
  topics: string[];
  topicsEs: string[];
  wants: string[];
  wantsLabel: Localized;
  unknowns: Localized[];
  origin?: Origin;
};
/** "next-steps": the draft is the one Rin's next steps write for the same person, so both tabs show one text. */
export type CofounderSignal = Common & { view: "cofounders"; person: Person; brings: string[]; skills: string[]; draft: Localized | "next-steps" | null };
export type ClientSignal = Common & { view: "clients"; name: string; need: string; needLabel: Localized; draft: Localized | null };
export type Signal = CofounderSignal | ClientSignal;

/** A public profile or post as the Treg boundary keeps it: no email, phone or contact field gets this far. */
export type PublicRow = { name: string; headline: string | null; location: string | null; url: string; date: string | null; provider: string };

/** Who answered a search or a relevance check, what it cost when Treg measured it, and when it was fetched. */
export type CallProvenance = { mode: "demo" | "live"; source: string; provider: string | null; callId: string | null; costMicro: number | null; at: number };

export const RELEVANCE_LABELS = ["relevant", "unclear", "not_relevant"] as const;
export type RelevanceLabel = (typeof RELEVANCE_LABELS)[number];
/** Jev's only part: one relevance label per signal. It never changes a check, a verdict or the order. */
export type Relevance =
  | { status: "labeled"; labels: Record<string, RelevanceLabel>; provenance: CallProvenance }
  | { status: "none"; reason: "demo" | "no-signals" | "cancelled" }
  | { status: "failed"; message: string };

/** A search as it is cached: relevance is null until it has been checked once. */
export type StoredRun = { view: View; query: string; signals: Signal[]; search: CallProvenance; relevance: Relevance | null };

type Option = { id: string; label: Localized };
type Presets = [Localized, ...Localized[]];
export type SignalsFixture = {
  plannedSource: string;
  cofounders: { presets: Presets; signals: CofounderSignal[]; options: Option[] };
  clients: { presets: Presets; signals: ClientSignal[]; options: Option[] };
};

export type SignalView = {
  id: string;
  view: View;
  name: string;
  first: string | null;
  headline: Localized | null;
  need: Localized | null;
  wants: Localized;
  source: Localized;
  recency: Localized;
  quote: string;
  quoteEs: string;
  location: string | null;
  brings: Localized[];
  unknowns: Localized[];
  draft: Localized | null;
  origin: Origin | null;
};
export type Verdict = { signal: SignalView; kept: boolean; checks: Check[]; failed: Check | null; backing: Backing[]; projects: string[] };

const presetsOf = (xs: Localized[]): Presets => {
  const [first, ...rest] = xs;
  if (!first) throw new Error("A Discover view needs at least one preset intent");
  return [first, ...rest];
};

const optionsOf = (xs: { id: string; en: string; es: string }[]): Option[] => xs.map(({ id, en, es }) => ({ id, label: { en, es } }));

function known(options: Option[], id: string, where: string): string {
  if (!options.some((o) => o.id === id)) throw new Error(`Unknown option "${id}" in ${where} of the Discover fixture`);
  return id;
}

const commonOf = (s: Common): Common => ({
  id: s.id,
  source: s.source,
  recency: s.recency,
  quote: s.quote,
  quoteEs: s.quoteEs,
  location: s.location,
  topics: s.topics,
  topicsEs: s.topicsEs,
  wants: s.wants,
  wantsLabel: s.wantsLabel,
  unknowns: s.unknowns,
});

type RawCofounder = Common & { ref?: string; name?: string; first?: string; headline?: Localized; brings: string[]; skills: string[]; draft?: Localized };

function cofounderOf(s: RawCofounder, skills: Option[]): CofounderSignal {
  const own = { view: "cofounders" as const, brings: s.brings, skills: s.skills.map((id) => known(skills, id, `"${s.id}"`)) };
  if (s.ref !== undefined) {
    if (s.ref !== "next-steps/cofounder.json" || s.name || s.draft) throw new Error(`"${s.id}" must take its identity and draft from next-steps/cofounder.json alone`);
    return { ...commonOf(s), ...own, person: EXAMPLE_COFOUNDER.person, draft: "next-steps" };
  }
  if (!s.name || !s.first || !s.headline) throw new Error(`"${s.id}" needs a name, a first name and a headline`);
  const brings = own.skills.map((id) => skills.find((o) => o.id === id)!.label);
  return { ...commonOf(s), ...own, person: { name: s.name, first: s.first, headline: s.headline, brings }, draft: s.draft ?? null };
}

function parse(raw: typeof signalsJson): SignalsFixture {
  const skills = optionsOf(raw.cofounders.skills);
  const needs = optionsOf(raw.clients.needs);
  return {
    plannedSource: raw.plannedSource,
    cofounders: { presets: presetsOf(raw.cofounders.presets), options: skills, signals: raw.cofounders.signals.map((s) => cofounderOf(s, skills)) },
    clients: {
      presets: presetsOf(raw.clients.presets),
      options: needs,
      signals: raw.clients.signals.map((s) => ({
        ...commonOf(s),
        view: "clients" as const,
        name: s.name,
        need: known(needs, s.need, `"${s.id}"`),
        needLabel: s.needLabel,
        draft: s.draft ?? null,
      })),
    },
  };
}

export const EXAMPLE_SIGNALS: SignalsFixture = parse(signalsJson);

const FILTER_FIELD = { cofounders: "skills", clients: "needs" } as const satisfies Record<View, keyof Filters>;

export function filterOptions(view: View, data = EXAMPLE_SIGNALS) {
  const signals: Signal[] = data[view].signals;
  const locations = [...new Set(signals.flatMap((s) => (s.location === null ? [] : [s.location])))].sort();
  return { field: FILTER_FIELD[view], options: data[view].options, locations };
}

const STOPWORDS = new Set(
  "someone anyone with that have has been from build building the and for into this need want wants teams team small there when them they their what which your about like people alguien cualquiera haya para construir construyendo equipos equipo pequeños cuando persona cómo como esté que con los las una por sus del".split(
    " ",
  ),
);
const PREFIX = 5;

export const contentWords = (text: string) => [...new Set(text.toLowerCase().match(/[a-záéíóúñü]+/g) ?? [])].filter((w) => w.length >= 4 && !STOPWORDS.has(w));
const hitsTopic = (word: string, topic: string) => word === topic || (word.length >= PREFIX && topic.length >= PREFIX && word.slice(0, PREFIX) === topic.slice(0, PREFIX));
const unique = (xs: string[]) => [...new Set(xs)];

const AVAILABILITY: Localized = { en: "Availability: unknown", es: "Disponibilidad: desconocida" };
const BUDGET: Localized = { en: "Budget: unknown", es: "Presupuesto: desconocido" };
const INTEREST: Localized = { en: "Interest in outside help: unknown", es: "Interés en ayuda externa: desconocido" };

function filtersReason(s: Signal, f: Filters): ReasonOf["filters"] {
  if (s.view === "cofounders" && f.skills.length > 0 && !s.skills.some((x) => f.skills.includes(x))) return { kind: "filter-skill" };
  if (s.view === "clients" && f.needs.length > 0 && !f.needs.includes(s.need)) return { kind: "filter-need" };
  if (f.location !== null && s.location !== f.location) return { kind: "filter-location", location: s.location };
  return { kind: "filters" };
}

/** Every check runs and is returned; the first failing one is the reason shown. Kept only when none fails. */
export function discover(model: PortfolioModel, view: View, intent: string, filters: Filters, signals: Signal[] = EXAMPLE_SIGNALS[view].signals): { kept: Verdict[]; dropped: Verdict[] } {
  const words = contentWords(intent);
  const pool = poolOf(model);
  const gapsToFill = unique([...pool.filter((c) => c.support === "unknown").map((c) => c.name), ...(model.nextBuild?.gaps ?? [])]);
  const shown = unique(pool.filter(evidenced).map((c) => c.name));
  const nextStepsDraft = cofounderPlan(model, EXAMPLE_COFOUNDER)?.draft ?? null;
  const first = model.person.firstName;
  const fill = (d: Localized): Localized => ({ en: d.en.replaceAll("{first}", first), es: d.es.replaceAll("{first}", first) });

  const verdicts = signals.map((s): Verdict => {
    const topics = [...s.topics, ...s.topicsEs];
    const hit = words.filter((w) => topics.some((t) => hitsTopic(w, t)));
    const intentR: ReasonOf["intent"] = hit.length ? { kind: "intent", words: hit } : { kind: "intent-miss" };

    const hits = pool.filter((c) => mentions(c.name, s.wants));
    const backing = backingOf(hits);
    const evidenceR: ReasonOf["evidence"] = backing.length
      ? { kind: "evidence", backing }
      : { kind: "evidence-miss", wants: s.wantsLabel, notShown: unique(hits.filter((c) => c.support === "unknown").map((c) => c.name)) };

    const checks: Check[] = [
      { id: "intent", pass: intentR.kind === "intent", reason: intentR },
      { id: "evidence", pass: evidenceR.kind === "evidence", reason: evidenceR },
    ];
    if (s.view === "cofounders") {
      const covers = gapsToFill.filter((g) => mentions(g, s.brings));
      const already = shown.filter((name) => mentions(name, s.brings));
      const complementR: ReasonOf["complement"] = covers.length
        ? { kind: "complement", covers }
        : already.length
          ? { kind: "complement-overlap", already }
          : { kind: "complement-miss" };
      checks.push({ id: "complement", pass: complementR.kind === "complement", reason: complementR });
    }
    const filtersR = filtersReason(s, filters);
    checks.push({ id: "filters", pass: filtersR.kind === "filters", reason: filtersR });

    const failed = checks.find((c) => !c.pass) ?? null;
    const kept = failed === null;
    const draft = s.draft === "next-steps" ? nextStepsDraft : s.draft && fill(s.draft);
    const common = { id: s.id, view, wants: s.wantsLabel, source: s.source, recency: s.recency, quote: s.quote, quoteEs: s.quoteEs, location: s.location, draft: kept ? draft : null, origin: s.origin ?? null };
    const signal: SignalView =
      s.view === "cofounders"
        ? { ...common, name: s.person.name, first: s.person.first, headline: s.person.headline, need: null, brings: s.person.brings, unknowns: [AVAILABILITY, ...s.unknowns] }
        : { ...common, name: s.name, first: null, headline: null, need: s.needLabel, brings: [], unknowns: [BUDGET, INTEREST, ...s.unknowns] };
    const projects = model.projects.filter((p) => backing.some((b) => b.proof.some((q) => q.projectTitle === p.title))).map((p) => p.title);
    return { signal, kept, checks, failed, backing, projects };
  });

  return {
    kept: verdicts.filter((v) => v.kept).sort((a, b) => b.backing.length - a.backing.length),
    dropped: verdicts.filter((v) => !v.kept),
  };
}

/** Outside text stays in its own language: the same words on both sides, never marked as translated. */
const asWritten = (text: string): Localized => ({ en: text, es: text });
const excerpt = (text: string) => (text.length > 90 ? `“${text.slice(0, 88).trimEnd()}…”` : `“${text}”`);

const LIVE_SOURCE: Record<Origin["kind"], Localized> = { profile: { en: "Public profile", es: "Perfil público" }, post: { en: "Public post on X", es: "Publicación pública en X" } };
const NO_DATE: Localized = { en: "Date not stated", es: "Fecha no indicada" };
const LIVE_DRAFT: Record<View, (them: string, url: string) => Localized> = {
  cofounders: (them, url) => ({
    en: `Hi ${them}, I found your public profile (${url}). I am looking for someone to build my next project with, and every line of my portfolio links to the file it comes from. Would you be open to a short call?\n\n{first}`,
    es: `Hola, ${them}: encontré tu perfil público (${url}). Busco a alguien con quien construir mi próximo proyecto, y cada línea de mi portafolio enlaza al archivo del que sale. ¿Te interesaría una llamada corta?\n\n{first}`,
  }),
  clients: (them, url) => ({
    en: `Hi ${them}, I read your public post (${url}). My portfolio shows work close to what you describe, and every line links to the file it comes from. Would a short call help?\n\n{first}`,
    es: `Hola, ${them}: leí tu publicación pública (${url}). Mi portafolio muestra trabajo cercano a lo que describes, y cada línea enlaza al archivo del que sale. ¿Te serviría una llamada corta?\n\n{first}`,
  }),
};

/**
 * A normalized public row as a Discover signal. Its own words are its topics and what it asks for or brings, so the
 * same code checks run on it as on the EXAMPLE list. Availability, budget and interest stay unknown (added by discover).
 */
export function liveSignal(view: View, row: PublicRow, index: number): Signal {
  const text = row.headline ?? "";
  const words = contentWords(text);
  const stems = unique(words.map((w) => w.slice(0, PREFIX)));
  const kind: Origin["kind"] = view === "cofounders" ? "profile" : "post";
  const common: Common = {
    id: `${kind}-${index + 1}`,
    source: LIVE_SOURCE[kind],
    recency: row.date ? asWritten(row.date) : NO_DATE,
    quote: text,
    quoteEs: "",
    location: row.location,
    topics: words,
    topicsEs: [],
    wants: stems,
    wantsLabel: asWritten(excerpt(text)),
    unknowns: [],
    origin: { kind, url: row.url, provider: row.provider, date: row.date },
  };
  const them = row.name.split(/\s+/)[0] || row.name;
  const draft = LIVE_DRAFT[view](them, row.url);
  return view === "cofounders"
    ? { ...common, view, person: { name: row.name, first: them, headline: asWritten(text), brings: [] }, brings: stems, skills: [], draft }
    : { ...common, view, name: row.name, need: "", needLabel: asWritten(text), draft };
}

/** Micro-USD as dollars, with only the decimals the amount needs: 1000000 is $1.00, 500 is $0.0005. */
export const usd = (micro: number) => `$${(micro / 1e6).toFixed(micro % 10_000 === 0 ? 2 : 6).replace(/(\.\d{2}\d*?)0+$/, "$1")}`;
