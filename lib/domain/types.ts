export type Mode = "fixture" | "live";

export const CLAIM_KINDS = ["contribution", "impact", "skill", "recognition"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

/** fetched: a source says it. corroborated: two independent sources. user_attested: only the builder says it. unverified: no support. */
export type ClaimState = "fetched" | "corroborated" | "user_attested" | "unverified";
export type ReviewStatus = "proposed" | "approved" | "rejected";

export const ATTRIBUTIONS = ["author", "co_author", "contributor", "reviewer", "unknown"] as const;
export type Attribution = (typeof ATTRIBUTIONS)[number];

/** Qualitative only. direct: the quote states the claim. partial: supports part of it. context: background only. */
export type EvidenceSupport = "direct" | "partial" | "context";

export type Support = "demonstrated" | "inferred" | "unknown";
export type Audience = "portfolio" | "attorney";
export type ReviewAction =
  | "approve"
  | "reject"
  | "correct"
  | "attest"
  | "reject_reading"
  | "confirm_reading";

export type ClaimRef = { claimId: string; revision: number };

export type StoredCapability = {
  key: string;
  name: string;
  support: Support;
  claimRefs: ClaimRef[];
  evidenceIds: string[];
  limits: string[];
};

export type StoredProjection = {
  generatedAt: number;
  ledgerRevision: number;
  engine: string;
  capabilities: StoredCapability[];
  gaps: string[];
  question: string | null;
  discarded: { name: string; reason: string }[];
  nextBuild: StoredNextBuild | null;
};

export type StoredNextBuild = {
  title: string;
  summary: string;
  parts: StoredCapability[];
  gaps: string[];
};

export const SUPPORT_RANK: Record<Support, number> = { unknown: 0, inferred: 1, demonstrated: 2 };

export const LIMITS = {
  projects: 3,
  sourcesPerProject: 5,
  questionsPerProject: 2,
  claimCallsPerProject: 1,
  inferenceCallsPerGoal: 1,
  capabilities: 3,
  claimsPerProject: 8,
} as const;

export type ImportReport = {
  engine: string;
  llmCalled: boolean;
  discarded: { text: string; reason: string }[];
  heldBack: { text: string; reason: string }[];
  skippedSources: { url: string; locator: string; reason: string }[];
};
