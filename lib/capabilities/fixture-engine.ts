import type { ProposedCapabilities, LedgerClaim } from "./types";

/**
 * Deterministic, model-free inference for fixture mode. It reads the current approved claims,
 * so corrections change its output exactly as they would change a model's input.
 */
type Template = {
  key: string;
  goalWords: string[];
  name: string;
  sharedName?: string;
  tags: string[];
  questionIfUnknown: string;
  limitIfUnknown: string;
};

const TEMPLATES: Template[] = [
  {
    key: "offline-sync",
    goalWords: ["sync", "offline", "conflict", "replication", "local-first"],
    name: "Design and ship offline-first sync with conflict resolution",
    sharedName: "Build offline sync and conflict handling inside a shared design",
    tags: ["sync", "conflict-resolution", "concurrency"],
    questionIfUnknown: "Which project of yours shows sync or conflict resolution working?",
    limitIfUnknown: "No source in the ledger shows sync work.",
  },
  {
    key: "android-client",
    goalWords: ["android", "kotlin", "mobile", " app"],
    name: "Build the Android client",
    tags: ["kotlin", "android"],
    questionIfUnknown: "Can you link an Android app or Kotlin code you wrote?",
    limitIfUnknown: "No source in the ledger shows mobile client work.",
  },
  {
    key: "production-ops",
    goalWords: ["own", "production", "on-call", "operate", "reliability", "scale"],
    name: "Run the sync layer in production",
    tags: ["operations", "on-call"],
    questionIfUnknown:
      "Have you operated a sync service in production? A postmortem, runbook or on-call rotation would settle it.",
    limitIfUnknown: "Nothing in the ledger shows production operation, on-call, or incident response.",
  },
  {
    key: "design-systems",
    goalWords: ["design system", "token", "component", "frontend", "ui "],
    name: "Migrate a product UI to design tokens",
    tags: ["design-systems"],
    questionIfUnknown: "Can you link UI or design-system work you shipped?",
    limitIfUnknown: "No source in the ledger shows design-system work.",
  },
  {
    key: "storage",
    goalWords: ["storage", "database", "durability", "wal", "rust"],
    name: "Fix correctness bugs in storage engines",
    tags: ["storage", "concurrency"],
    questionIfUnknown: "Can you link storage or database work you shipped?",
    limitIfUnknown: "No source in the ledger shows storage work.",
  },
];

export function inferWithFixtureRules(goal: string, claims: LedgerClaim[]): ProposedCapabilities {
  const g = ` ${goal.toLowerCase()} `;
  const matched = TEMPLATES.filter((t) => t.goalWords.some((w) => g.includes(w))).slice(0, 3);

  if (!matched.length) {
    return {
      capabilities: [],
      gaps: [`Nothing in the approved claims relates to "${goal}".`],
      question: `What work of yours shows you can ${goal.charAt(0).toLowerCase()}${goal.slice(1)}? Link a repository, pull request or write-up.`,
    };
  }

  let question: string | null = null;
  const gaps: string[] = [];
  const capabilities = matched.map((t) => {
    const cited = claims.filter((c) => c.tags.some((tag) => t.tags.includes(tag)));
    if (!cited.length) {
      gaps.push(t.limitIfUnknown);
      question ??= t.questionIfUnknown;
      return { name: t.name, support: "unknown" as const, claimIds: [], evidenceIds: [], limits: [t.limitIfUnknown] };
    }
    const primaryShared = cited.some((c) => c.kind === "contribution" && c.attribution === "co_author");
    return {
      name: primaryShared && t.sharedName ? t.sharedName : t.name,
      support: "demonstrated" as const,
      claimIds: cited.map((c) => c.id),
      evidenceIds: cited.flatMap((c) => c.evidence.map((e) => e.id)),
      limits: [],
    };
  });

  return { capabilities, gaps, question };
}
