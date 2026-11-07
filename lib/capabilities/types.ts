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

export const proposedCapabilitiesSchema = z.object({
  capabilities: z
    .array(
      z.object({
        name: z.string().min(3).max(120).describe("What could be entrusted, as a short verb phrase"),
        support: z.enum(["demonstrated", "inferred", "unknown"]),
        claimIds: z.array(z.string()).max(8).describe("IDs of approved claims that support it; empty when unknown"),
        evidenceIds: z.array(z.string()).max(12),
        limits: z.array(z.string().max(200)).max(3).describe("What this evidence does not show"),
      }),
    )
    .max(LIMITS.capabilities),
  gaps: z.array(z.string().max(200)).max(3),
  question: z.string().max(240).nullable().describe("At most one bounded question that would close the biggest gap"),
});

export type ProposedCapabilities = z.infer<typeof proposedCapabilitiesSchema>;
