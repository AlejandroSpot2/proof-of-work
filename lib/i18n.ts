import es from "@/fixtures/example-rin/i18n/es.json";
import type { Support } from "@/lib/domain/types";

export type Lang = "en" | "es";
export const LANGS: Lang[] = ["en", "es"];
export type Localized = Record<Lang, string>;
export type Shown = { text: string; translated: boolean };

const ES_CONTENT = new Map(Object.entries(es.content));

/** A content string of the EXAMPLE portfolio, in Spanish only when a prepared translation exists for that exact text. */
export function content(text: string, lang: Lang, example: boolean): Shown {
  const translation = lang === "es" && example ? ES_CONTENT.get(text) : undefined;
  return translation === undefined ? { text, translated: false } : { text: translation, translated: true };
}

/** Prepared fixture text written in both languages; the Spanish side is a translation of the English side. */
export const localized = (text: Localized, lang: Lang): Shown => ({ text: text[lang], translated: lang === "es" });

const ES_MONTHS: Record<string, string> = { Jan: "ene", Feb: "feb", Mar: "mar", Apr: "abr", May: "may", Jun: "jun", Jul: "jul", Aug: "ago", Sep: "sep", Oct: "oct", Nov: "nov", Dec: "dic" };

export function period(text: string | null, lang: Lang): string | null {
  if (text === null || lang === "en") return text;
  return text.replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (m) => ES_MONTHS[m] ?? m);
}

export const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export const join = (items: string[], word: string) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} ${word} ${items[items.length - 1]}`);

export type PathId = "apply" | "strengthen" | "cofounder";
export type ImprovementKind = "demo" | "document" | "new-piece";

const EN = {
  level: { demonstrated: "Shown in the work", inferred: "Likely, not proven", unknown: "Not shown yet" } as Record<Support, string>,
  signal: { current_posting_states_sponsorship: "Posting says it sponsors", historical_filings: "Past filings only", unknown: "Sponsorship unknown" } as Record<string, string>,
  language: "Language",
  examplePortfolio: "EXAMPLE portfolio",
  sections: "Portfolio sections",
  projects: "Projects",
  nav: { work: "Work", trust: "What to hand over", next: "Next", sf: "San Francisco" },
  translatedNote: null as string | null,
  factRole: "Role",
  factLocation: "Location",
  factRecord: "Record",
  builder: "Builder",
  record: (projects: number, files: number) => `${projects} projects · ${files} source files · every sentence linked to its file`,
  workCount: (n: number) => `Selected work, ${n} projects`,
  work: "Selected work",
  shared: "shared",
  openProject: "Open the project",
  proof: "Proof",
  openNamed: (title: string) => `Open ${title}`,
  handTitle: (first: string) => `What you can hand ${first}`,
  forGoal: "For:",
  fromProjects: (projects: string[]) => `From ${join(projects, "and")}`,
  nothingYet: "Nothing in the files shows this yet.",
  nextTitle: (first: string) => `What ${first} could build next`,
  proposal: "A proposal, not a promise",
  stillNeeds: "Still needs:",
  fromProject: (title: string) => `from ${title}`,
  sfTitle: "Heading to San Francisco",
  sfNote: (first: string) =>
    `${first} is outside the US. Three EXAMPLE roles, each with what its own source says about sponsorship. Not legal advice. Historical filings ≠ current policy. One role’s sponsorship ≠ all visa types.`,
  locationUnknown: "location unknown",
  snippetUnknown: "Snippet unknown",
  read: (date: string | null) => `Read ${date ?? "on an unknown date"}`,
  fits: "Fits:",
  proofLower: "proof",
  noFit: "No evidenced work matches this role.",
  whyFits: (first: string, company: string) => `Why ${first} fits ${company}`,
  footExample: "EXAMPLE portfolio of a fictional builder, made from synthetic files. ",
  footNote: "Every sentence on this page opens the file it came from. Built with Proof of Work.",
  allWork: "← All work",
  partOf: (first: string) => `${first}’s part`,
  outcome: "Outcome.",
  notShown: "Not shown yet.",
  history: "Who did what, by date",
  ownFiles: "From the project’s own files",
  proofWords: "Proof, word for word",
  openFile: "open the file",
  drawerKicker: "Proof, word for word from the files",
  close: "Close",
  next: {
    heading: "What do you want to do next?",
    example: "Everything here is a prepared EXAMPLE. Nothing is sent or published.",
    live: "Next steps use prepared EXAMPLE data in this demo.",
    paths: "What to do next",
    path: {
      apply: { title: "Apply for a role", line: "Check a posting against the files" },
      strengthen: { title: "Strengthen my portfolio", line: "See what would make the work stronger" },
      cofounder: { title: "Find a cofounder", line: "Plan the next build with someone" },
    } as Record<PathId, { title: string; line: string }>,
    choose: "Choose a path to see what the files support.",
    posting: "Posting",
    postingRead: (date: string) => `Posting read ${date} · EXAMPLE`,
    outputLanguage: "Output language",
    score: (n: number, total: number) => `The files back ${n} of ${total} requirements`,
    backed: "Backed by evidence",
    gap: "Gap",
    othersWrote: (who: string) => `In the files, but ${who} wrote it:`,
    more: (n: number) => `+${n} more`,
    nothing: "Nothing in the files shows this.",
    notShown: "Not shown in the files yet.",
    intro: "Adapted intro",
    forRole: "The portfolio for this role",
    backs: (n: number, total: number) => `Backs ${n} of ${total}`,
    adaptedFor: (company: string) => `Adapted for ${company}`,
    goal: "Goal",
    kind: { demo: "Demo", document: "Document", "new-piece": "New piece" } as Record<ImprovementKind, string>,
    proves: "What it would prove",
    buildsOn: "Builds on",
    today: "Today",
    ifDone: "If done",
    notTrueYet: "not true yet",
    notInFiles: "Not in the files",
    fromNext: (first: string) => `From what ${first} could build next`,
    brings: (first: string) => `What ${first} brings`,
    complement: (first: string) => `Who would complement ${first}`,
    possible: "One possible cofounder",
    synthetic: "Synthetic EXAMPLE profile · not a real person",
    selfDescribed: "Self-described, not verified",
    together: "Build together",
    questions: "Open questions",
    draft: "Intro draft",
    copy: "Copy draft",
    copied: "Copied",
    draftNote: (other: string) => `Draft only. Nothing is sent. ${other} has not seen this.`,
    noProject: "There is no next build in the files to plan around yet.",
  },
};

export type UiWords = typeof EN;

const ES: UiWords = {
  level: { demonstrated: "Mostrado en el trabajo", inferred: "Probable, sin probar", unknown: "Todavía no mostrado" },
  signal: { current_posting_states_sponsorship: "La oferta dice que patrocina", historical_filings: "Solo solicitudes anteriores", unknown: "Patrocinio desconocido" },
  language: "Idioma",
  examplePortfolio: "Portafolio EXAMPLE",
  sections: "Secciones del portafolio",
  projects: "Proyectos",
  nav: { work: "Trabajo", trust: "Qué confiarle", next: "Lo próximo", sf: "San Francisco" },
  translatedNote: "Versión en español. El texto con subrayado punteado está traducido del inglés; las citas, los archivos y los nombres se muestran tal como están.",
  factRole: "Perfil",
  factLocation: "Ubicación",
  factRecord: "Registro",
  builder: "Construye software",
  record: (projects, files) => `${projects} proyectos · ${files} archivos fuente · cada frase enlazada a su archivo`,
  workCount: (n) => `Trabajo seleccionado, ${n} proyectos`,
  work: "Trabajo seleccionado",
  shared: "compartido",
  openProject: "Abrir el proyecto",
  proof: "Pruebas",
  openNamed: (title) => `Abrir ${title}`,
  handTitle: (first) => `Qué le puedes confiar a ${first}`,
  forGoal: "Para:",
  fromProjects: (projects) => `De ${join(projects, "y")}`,
  nothingYet: "Nada en los archivos lo muestra todavía.",
  nextTitle: (first) => `Qué podría construir ${first} después`,
  proposal: "Una propuesta, no una promesa",
  stillNeeds: "Aún falta:",
  fromProject: (title) => `de ${title}`,
  sfTitle: "Rumbo a San Francisco",
  sfNote: (first) =>
    `${first} está fuera de EE. UU. Tres puestos EXAMPLE, cada uno con lo que dice su propia fuente sobre el patrocinio. No es asesoría legal. Solicitudes anteriores ≠ política actual. El patrocinio de un puesto ≠ todos los tipos de visa.`,
  locationUnknown: "ubicación desconocida",
  snippetUnknown: "Fragmento desconocido",
  read: (date) => (date ? `Leído el ${date}` : "Leído en una fecha desconocida"),
  fits: "Encaja:",
  proofLower: "pruebas",
  noFit: "Ningún trabajo con evidencia encaja con este puesto.",
  whyFits: (first, company) => `Por qué ${first} encaja en ${company}`,
  footExample: "Portafolio EXAMPLE de una persona ficticia, hecho con archivos sintéticos. ",
  footNote: "Cada frase de esta página abre el archivo del que salió. Hecho con Proof of Work.",
  allWork: "← Todo el trabajo",
  partOf: (first) => `La parte de ${first}`,
  outcome: "Resultado.",
  notShown: "Todavía no mostrado.",
  history: "Quién hizo qué, por fecha",
  ownFiles: "De los archivos del propio proyecto",
  proofWords: "Pruebas, palabra por palabra",
  openFile: "abrir el archivo",
  drawerKicker: "Pruebas, palabra por palabra desde los archivos",
  close: "Cerrar",
  next: {
    heading: "¿Qué quieres hacer ahora?",
    example: "Todo lo que ves aquí es un EXAMPLE preparado. No se envía ni se publica nada.",
    live: "Los próximos pasos usan datos EXAMPLE preparados en esta demo.",
    paths: "Qué hacer ahora",
    path: {
      apply: { title: "Postularme a un puesto", line: "Compara una oferta con los archivos" },
      strengthen: { title: "Fortalecer mi portafolio", line: "Mira qué haría más sólido el trabajo" },
      cofounder: { title: "Encontrar a alguien para cofundar", line: "Planea el próximo proyecto en equipo" },
    },
    choose: "Elige un camino para ver qué respaldan los archivos.",
    posting: "Oferta",
    postingRead: (date) => `Oferta leída el ${date} · EXAMPLE`,
    outputLanguage: "Idioma del resultado",
    score: (n, total) => `Los archivos respaldan ${n} de ${total} requisitos`,
    backed: "Respaldado por evidencia",
    gap: "Sin evidencia",
    othersWrote: (who) => `Está en los archivos, pero lo escribió ${who}:`,
    more: (n) => `y ${n} más`,
    nothing: "Nada en los archivos lo muestra.",
    notShown: "Todavía no se muestra en los archivos.",
    intro: "Presentación adaptada",
    forRole: "El portafolio para este puesto",
    backs: (n, total) => `Respalda ${n} de ${total}`,
    adaptedFor: (company) => `Adaptado para ${company}`,
    goal: "Meta",
    kind: { demo: "Demo", document: "Documento", "new-piece": "Pieza nueva" },
    proves: "Qué demostraría",
    buildsOn: "Parte de",
    today: "Hoy",
    ifDone: "Si se hace",
    notTrueYet: "todavía no es cierto",
    notInFiles: "No está en los archivos",
    fromNext: (first) => `De lo que ${first} podría construir después`,
    brings: (first) => `Lo que aporta ${first}`,
    complement: (first) => `Quién complementaría a ${first}`,
    possible: "Una posible persona cofundadora",
    synthetic: "Perfil sintético EXAMPLE · no es una persona real",
    selfDescribed: "Descrito por su cuenta, sin verificar",
    together: "Construir en equipo",
    questions: "Preguntas abiertas",
    draft: "Borrador de presentación",
    copy: "Copiar borrador",
    copied: "Copiado",
    draftNote: (other) => `Solo es un borrador. No se envía nada. ${other} no lo ha visto.`,
    noProject: "Todavía no hay en los archivos un próximo proyecto sobre el cual planear.",
  },
};

/** The app's own words. They are not marked as translated: both languages are the app's. */
export const UI: Record<Lang, UiWords> = { en: EN, es: ES };
