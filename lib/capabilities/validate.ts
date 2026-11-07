import type { StoredCapability, StoredProjection } from "@/lib/domain/types";
import { LIMITS } from "@/lib/domain/types";
import { capSupport, derivedLimits, supportCeiling, type CitedClaim } from "@/lib/domain/rules";
import type { LedgerClaim, ProposedCapabilities } from "./types";

export function toCited(c: LedgerClaim): CitedClaim {
  return {
    id: c.id,
    text: c.text,
    kind: c.kind,
    state: c.state,
    attribution: c.attribution,
    attributionNote: c.attributionNote,
    evidenceLocators: c.evidence.map((e) => e.locator),
  };
}

/**
 * The model (or fixture rules) only proposes. Citations to unknown or unapproved IDs discard the
 * capability, support is capped by what the cited claims can carry, and limits are derived from the ledger.
 */
export function validateProposal(
  proposal: ProposedCapabilities,
  approved: LedgerClaim[],
  meta: { engine: string; ledgerRevision: number; now: number },
): StoredProjection {
  const byId = new Map(approved.map((c) => [c.id, c]));
  const evidenceOwner = new Map(approved.flatMap((c) => c.evidence.map((e) => [e.id, c.id] as const)));
  const discarded: StoredProjection["discarded"] = [];
  const capabilities: StoredCapability[] = [];

  for (const [i, p] of proposal.capabilities.slice(0, LIMITS.capabilities).entries()) {
    const badClaim = p.claimIds.find((id) => !byId.has(id));
    const badEvidence = p.evidenceIds.find((id) => !evidenceOwner.has(id));
    if (badClaim || badEvidence) {
      discarded.push({ name: p.name, reason: `Cited ${badClaim ?? badEvidence}, which is not an approved claim or its evidence.` });
      continue;
    }
    const cited = p.claimIds.map((id) => byId.get(id)!);
    const evidenceIds = p.evidenceIds.filter((id) => p.claimIds.includes(evidenceOwner.get(id)!));
    const ceiling = supportCeiling(cited.map(toCited));
    const support = cited.length ? capSupport(p.support, ceiling) : "unknown";
    const limits = [...new Set([...derivedLimits(cited.map(toCited)), ...p.limits])].slice(0, 4);
    if (support !== p.support) limits.push(`Capped at ${support}: the cited claims cannot carry ${p.support}.`);
    capabilities.push({
      key: `cap-${i + 1}`,
      name: p.name,
      support,
      claimRefs: cited.map((c) => ({ claimId: c.id, revision: c.revision })),
      evidenceIds,
      limits,
    });
  }

  return {
    generatedAt: meta.now,
    ledgerRevision: meta.ledgerRevision,
    engine: meta.engine,
    capabilities,
    gaps: proposal.gaps.slice(0, 3),
    question: proposal.question ?? null,
    discarded,
  };
}
