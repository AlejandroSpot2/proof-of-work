import offerJson from "@/fixtures/example-rin/next-steps/offer.json";
import strengthenJson from "@/fixtures/example-rin/next-steps/strengthen.json";
import cofounderJson from "@/fixtures/example-rin/next-steps/cofounder.json";
import type { Commit, PortfolioCapability, PortfolioModel, ProofItem } from "@/lib/portfolio";
import type { Support } from "@/lib/domain/types";
import { mentions } from "@/lib/match";
import { content, join, lowerFirst, type ImprovementKind, type Lang, type Localized } from "@/lib/i18n";

/** A fixture names what to look for; whether the files show it is always computed from the model's proof. */

export type OfferFixture = {
  id: string;
  company: string;
  role: string;
  location: string;
  retrieved: string;
  requirements: { id: string; line: string; es: string; short: Localized; match: string[] }[];
};

export type StrengthenFixture = {
  goals: { id: string; from: "profile" | "offer"; label: Localized; improvements: string[] }[];
  improvements: {
    id: string;
    kind: ImprovementKind;
    title: Localized;
    why: Localized;
    proves: Localized;
    ifDone: Localized;
    buildsOn: { project: string; locator: string }[];
    changes: string[];
  }[];
};

export type CofounderFixture = {
  project: string;
  person: { name: string; first: string; headline: Localized; brings: Localized[] };
  needs: { gap: string; text: Localized }[];
  together: Localized[];
  questions: Localized[];
  draft: Localized;
};

function oneOf<T extends string>(allowed: readonly T[], value: string): T {
  const hit = allowed.find((a) => a === value);
  if (!hit) throw new Error(`Unexpected value "${value}" in a next-steps fixture`);
  return hit;
}

export const EXAMPLE_OFFER: OfferFixture = offerJson;
export const EXAMPLE_STRENGTHEN: StrengthenFixture = {
  goals: strengthenJson.goals.map((g) => ({ ...g, from: oneOf(["profile", "offer"], g.from) })),
  improvements: strengthenJson.improvements.map((i) => ({ ...i, kind: oneOf(["demo", "document", "new-piece"], i.kind) })),
};
export const EXAMPLE_COFOUNDER: CofounderFixture = cofounderJson;

type Evidenced = PortfolioCapability & { support: "demonstrated" | "inferred" };
export const evidenced = (c: PortfolioCapability): c is Evidenced => c.support !== "unknown" && c.proof.length > 0;

/** Names only: a statement's text can mention work it disowns ("the deploy engine is Contributor C's"). */
export const poolOf = (model: PortfolioModel) => [...model.capabilities, ...(model.nextBuild?.parts ?? [])];

const uniqueBy = <T>(xs: T[], key: (x: T) => string) => xs.filter((x, i) => xs.findIndex((y) => key(y) === key(x)) === i);

export type Backing = { name: string; support: "demonstrated" | "inferred"; projects: string[]; proof: ProofItem[] };

/** The pool items that back a match: evidenced, with proof, one per name. */
export const backingOf = (hits: PortfolioCapability[]): Backing[] =>
  uniqueBy(hits.filter(evidenced), (c) => c.name).map(({ name, support, projects, proof }) => ({ name, support, projects, proof }));

export type GapReason =
  | { kind: "not-shown"; capability: string; limit: string | null }
  | { kind: "others"; who: string; project: string; commits: [Commit, ...Commit[]] }
  | { kind: "nothing" };
export type RequirementStatus = { kind: "backed"; backing: Backing[] } | { kind: "gap"; reason: GapReason };
export type RequirementResult = { id: string; line: string; lineEs: string; short: Localized; status: RequirementStatus };
export type ApplyPlan = {
  offer: { id: string; company: string; role: string; location: string; retrieved: string };
  requirements: RequirementResult[];
  projects: { slug: string; title: string; backs: string[] }[];
  backed: number;
  total: number;
};

function gapReason(model: PortfolioModel, hits: PortfolioCapability[], stems: string[]): GapReason {
  const unknown = hits.find((c) => c.support === "unknown");
  if (unknown) return { kind: "not-shown", capability: unknown.name, limit: unknown.limit };
  for (const p of model.projects) {
    for (const o of p.others) {
      const [first, ...rest] = o.commits.filter((c) => mentions(c.message, stems));
      if (first) return { kind: "others", who: o.who, project: p.title, commits: [first, ...rest] };
    }
  }
  return { kind: "nothing" };
}

export function applyPlan(model: PortfolioModel, offer: OfferFixture): ApplyPlan {
  const pool = poolOf(model);
  const requirements = offer.requirements.map((r): RequirementResult => {
    const hits = pool.filter((c) => mentions(c.name, r.match));
    const backing = backingOf(hits);
    const status: RequirementStatus = backing.length ? { kind: "backed", backing } : { kind: "gap", reason: gapReason(model, hits, r.match) };
    return { id: r.id, line: r.line, lineEs: r.es, short: r.short, status };
  });
  const backed = requirements.flatMap((r) => (r.status.kind === "backed" ? [{ id: r.id, backing: r.status.backing }] : []));
  const projects = model.projects
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      backs: backed.filter((r) => r.backing.some((b) => b.proof.some((q) => q.projectTitle === p.title))).map((r) => r.id),
    }))
    .sort((a, b) => b.backs.length - a.backs.length);
  const { id, company, role, location, retrieved } = offer;
  return { offer: { id, company, role, location, retrieved }, requirements, projects, backed: backed.length, total: requirements.length };
}

type IntroParts = { role: string; company: string; first: string; backed: number; total: number; shown: string[]; missing: string[] };

const INTRO: Record<Lang, (a: IntroParts) => string[]> = {
  en: (a) => [
    `For the “${a.role}” role at ${a.company}, ${a.first}'s files back ${a.backed} of the ${a.total} requirements${a.shown.length ? `: ${join(a.shown, "and")}` : ""}.`,
    a.missing.length ? `They do not show ${join(a.missing, "or")} yet.` : "",
  ],
  es: (a) => [
    `Para el puesto «${a.role}» en ${a.company}, los archivos de ${a.first} respaldan ${a.backed} de los ${a.total} requisitos${a.shown.length ? `: ${join(a.shown, "y")}` : ""}.`,
    a.missing.length ? `Todavía no muestran ${join(a.missing, "ni")}.` : "",
  ],
};

/** Composed only from the plan: what the files back, then what they do not show yet. */
export function adaptedIntro(plan: ApplyPlan, model: PortfolioModel, lang: Lang): string {
  const shorts = (kind: RequirementStatus["kind"]) => plan.requirements.filter((r) => r.status.kind === kind).map((r) => r.short[lang]);
  return INTRO[lang]({
    role: plan.offer.role,
    company: plan.offer.company,
    first: model.person.firstName,
    backed: plan.backed,
    total: plan.total,
    shown: shorts("backed"),
    missing: shorts("gap"),
  })
    .filter(Boolean)
    .join(" ");
}

export type ImprovementView = {
  id: string;
  kind: ImprovementKind;
  priority: number;
  title: Localized;
  why: Localized;
  proves: Localized;
  ifDone: Localized;
  buildsOn: { project: string; locator: string; sourceId: string | null }[];
  today: { name: string; support: Support } | null;
};
export type StrengthenPlan = { goal: { id: string; from: "profile" | "offer"; label: Localized }; improvements: ImprovementView[] };

function sourceIndex(model: PortfolioModel): Map<string, string> {
  const index = new Map(model.projects.flatMap((p) => p.documents.map((d) => [`${p.title}|${d.locator}`, d.sourceId] as const)));
  for (const q of [...model.projects.flatMap((p) => p.proof), ...poolOf(model).flatMap((c) => c.proof)]) index.set(`${q.projectTitle}|${q.locator}`, q.sourceId);
  return index;
}

export function strengthenPlan(model: PortfolioModel, fixture: StrengthenFixture, goalId: string): StrengthenPlan {
  const goal = fixture.goals.find((g) => g.id === goalId);
  if (!goal) throw new Error(`Unknown goal "${goalId}"`);
  const pool = poolOf(model);
  const sources = sourceIndex(model);
  const improvements = goal.improvements.map((id, i): ImprovementView => {
    const imp = fixture.improvements.find((x) => x.id === id);
    if (!imp) throw new Error(`Unknown improvement "${id}" in goal "${goalId}"`);
    const today = pool.find((c) => mentions(c.name, imp.changes));
    return {
      id,
      kind: imp.kind,
      priority: i + 1,
      title: imp.title,
      why: imp.why,
      proves: imp.proves,
      ifDone: imp.ifDone,
      buildsOn: imp.buildsOn.map((b) => ({ ...b, sourceId: sources.get(`${b.project}|${b.locator}`) ?? null })),
      today: today ? { name: today.name, support: today.support } : null,
    };
  });
  return { goal: { id: goal.id, from: goal.from, label: goal.label }, improvements };
}

export type CofounderPlan = {
  project: { title: string; summary: string };
  brings: PortfolioCapability[];
  needs: { text: Localized; because: string }[];
  person: CofounderFixture["person"] & { synthetic: true };
  together: Localized[];
  questions: Localized[];
  draft: Localized;
};

export function cofounderPlan(model: PortfolioModel, fixture: CofounderFixture): CofounderPlan | null {
  const nb = model.nextBuild;
  if (!nb || nb.title !== fixture.project) return null;
  const project: Localized = { en: nb.title, es: content(nb.title, "es", model.example).text };
  const fill = (text: string, lang: Lang) => text.replaceAll("{first}", model.person.firstName).replaceAll("{project}", lowerFirst(project[lang]));
  return {
    project: { title: nb.title, summary: nb.summary },
    brings: nb.parts.filter(evidenced),
    needs: fixture.needs.flatMap((need) => {
      const because = nb.gaps.find((g) => g.startsWith(need.gap));
      return because ? [{ text: need.text, because }] : [];
    }),
    person: { ...fixture.person, synthetic: true },
    together: fixture.together,
    questions: fixture.questions,
    draft: { en: fill(fixture.draft.en, "en"), es: fill(fixture.draft.es, "es") },
  };
}
