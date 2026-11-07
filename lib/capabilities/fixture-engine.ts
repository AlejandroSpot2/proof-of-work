import type { ProposedCapabilities, LedgerClaim } from "./types";

/**
 * Deterministic, model-free inference for fixture mode. It reads the current approved claims, so a
 * correction changes its output exactly as it would change a model's input. Support levels it proposes
 * are always capped by the ledger in validateProposal.
 */
type Template = {
  goalWords: string[];
  name: string;
  tags: string[];
  ifUnknown: { gap: string; question: string };
};

const TEMPLATES: Template[] = [
  {
    goalWords: ["sync", "offline", "conflict", "local-first", "replication"],
    name: "Design and ship offline-first sync with conflict resolution",
    tags: ["sync", "conflict-resolution"],
    ifUnknown: {
      gap: "No source in the ledger shows sync work.",
      question: "Which project of yours shows sync or conflict resolution working?",
    },
  },
  {
    goalWords: [" ai ", " ai,", "llm", "model", "tagging", "structured"],
    name: "Build AI features with schema-checked output and injection defenses",
    tags: ["structured-outputs", "prompt-injection"],
    ifUnknown: {
      gap: "No source in the ledger shows AI feature work.",
      question: "Can you link an AI feature you shipped, with how its output was checked?",
    },
  },
  {
    goalWords: ["release", "deploy", "shipping", "ci/cd"],
    name: "Own releases and preview deploys",
    tags: ["releases", "deployment"],
    ifUnknown: {
      gap: "No source in the ledger shows release or deploy work.",
      question: "Can you link a release process or deploy pipeline you ran?",
    },
  },
  {
    goalWords: ["production", "scale", "on-call", "operate", "reliability"],
    name: "Run it in production",
    tags: ["operations", "on-call", "production"],
    ifUnknown: {
      gap: "Nothing in the ledger shows real users, production traffic, or on-call work. Every benchmark and eval is synthetic.",
      question: "Has any of this run in production with real users? A postmortem, usage log or on-call rotation would settle it.",
    },
  },
];

const NEXT_BUILD = {
  title: "Offline field-notes app with AI tagging",
  summary:
    "A bounded MVP: inspectors capture notes with no signal, edits merge per field when devices reconnect, and an AI model tags each note into a fixed schema on sync.",
  parts: [
    { name: "Offline capture and per-field merge", tags: ["sync", "conflict-resolution"] },
    { name: "Timeline rebuilt from a local event log", tags: ["event-sourcing"] },
    { name: "AI tagging that must match a schema", tags: ["structured-outputs"] },
    { name: "Note text treated as data, never as instructions", tags: ["prompt-injection"] },
  ],
  gaps: [
    "Production scale: nothing shows Tidepool or Quietroom with real users.",
    "Real-data quality: Quietroom was evaluated on 20 synthetic examples only.",
  ],
};

const KIND_ORDER = { contribution: 0, recognition: 1, impact: 2, skill: 3 } as const;

/** Strongest first: what the person did, then what it achieved, then described practice. */
const cite = (claims: LedgerClaim[], tags: string[]) =>
  claims.filter((c) => c.tags.some((t) => tags.includes(t))).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

export function inferWithFixtureRules(goal: string, claims: LedgerClaim[]): ProposedCapabilities {
  const g = ` ${goal.toLowerCase()} `;
  const matched = TEMPLATES.filter((t) => t.goalWords.some((w) => g.includes(w))).slice(0, 3);

  const parts = NEXT_BUILD.parts
    .map((p) => ({ name: p.name, claimIds: cite(claims, p.tags).map((c) => c.id), evidenceIds: [] }))
    .filter((p) => p.claimIds.length);
  const nextBuild = parts.length >= 2 ? { title: NEXT_BUILD.title, summary: NEXT_BUILD.summary, parts, gaps: NEXT_BUILD.gaps } : null;

  if (!matched.length) {
    return {
      capabilities: [],
      gaps: [`Nothing in the approved claims relates to "${goal}".`],
      question: `What work of yours shows this: "${goal}"? Link a repository, pull request or write-up.`,
      nextBuild,
    };
  }

  let question: string | null = null;
  const gaps: string[] = [];
  const capabilities = matched.map((t) => {
    const cited = cite(claims, t.tags);
    if (!cited.length) {
      gaps.push(t.ifUnknown.gap);
      question ??= t.ifUnknown.question;
      return { name: t.name, support: "unknown" as const, claimIds: [], evidenceIds: [], limits: [t.ifUnknown.gap] };
    }
    return { name: t.name, support: "demonstrated" as const, claimIds: cited.map((c) => c.id), evidenceIds: [], limits: [] };
  });

  return { capabilities, gaps, question, nextBuild };
}
