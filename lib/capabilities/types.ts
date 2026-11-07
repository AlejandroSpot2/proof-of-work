import { z } from "zod";
import type { Attribution, ClaimKind, ClaimState, EvidenceSupport } from "@/lib/domain/types";
import { LIMITS } from "@/lib/domain/types";

export type LedgerEvidence = {
  id: string;
  sourceId: string;
  quote: string;
  locator: string;
  supportScore: EvidenceSupport;
  sourceUrl: string;
};

export type LedgerClaim = {
  id: string;
  projectId: string;
  projectTitle: string;
  text: string;
  kind: ClaimKind;
  state: ClaimState;
  attribution: Attribution;
  attributionNote: string | null;
  revision: number;
  tags: string[];
  publishable: boolean;
  legalFlag: string | null;
  evidence: LedgerEvidence[];
};

/** Structure only. validateProposal enforces counts and lengths per item, so one long field never sinks the answer. */
export const proposedCapabilitiesSchema = z.object({
  capabilities: z
    .array(
      z.object({
        name: z.string().describe("What could be entrusted, as a short verb phrase of at most 12 words"),
        support: z.enum(["demonstrated", "inferred", "unknown"]),
        claimIds: z.array(z.string()).describe("IDs of approved claims that support it; empty when unknown"),
        evidenceIds: z.array(z.string()),
        limits: z.array(z.string()).describe("Up to 3 short notes on what this evidence does not show"),
      }),
    )
    .describe(`At most ${LIMITS.capabilities} capabilities`),
  gaps: z.array(z.string()).describe("Up to 3 short gaps"),
  question: z.string().nullable().describe("At most one bounded question that would close the biggest gap"),
  nextBuild: z
    .object({
      title: z.string().describe("A bounded MVP this person could build next, combining their evidenced work, at most 8 words"),
      summary: z.string().describe("One or two sentences"),
      parts: z
        .array(
          z.object({
            name: z.string(),
            claimIds: z.array(z.string()),
            evidenceIds: z.array(z.string()),
          }),
        )
        .describe("Up to 4 parts, each citing at least one approved claim"),
      gaps: z.array(z.string()).describe("Up to 3 things the evidence does not cover for this MVP"),
    })
    .nullable()
    .describe("A proposal, not a promise of timeline or ability. null if the claims do not combine into anything."),
});

export type ProposedCapabilities = z.infer<typeof proposedCapabilitiesSchema>;
