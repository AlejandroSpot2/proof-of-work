import type { StoredCapability, StoredNextBuild, StoredProjection, Support } from "@/lib/domain/types";
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
    revision: c.revision,
    evidenceLocators: c.evidence.map((e) => e.locator),
  };
}

const NAME_MAX = 140;

type Citation = { name: string; support: Support; claimIds: string[]; evidenceIds: string[]; limits: string[] };

function makeChecker(approved: LedgerClaim[]) {
  const byId = new Map(approved.map((c) => [c.id, c]));
  const evidenceOwner = new Map(approved.flatMap((c) => c.evidence.map((e) => [e.id, c.id] as const)));
  return (p: Citation, key: string): { ok: true; cap: StoredCapability } | { ok: false; reason: string } => {
    if (!p.name.trim() || p.name.length > NAME_MAX) return { ok: false, reason: `Its name is ${p.name.trim() ? `over ${NAME_MAX} characters` : "empty"}.` };
    const bad = p.claimIds.find((id) => !byId.has(id)) ?? p.evidenceIds.find((id) => !evidenceOwner.has(id));
    if (bad) return { ok: false, reason: `Cited ${bad}, which is not an approved claim or its evidence.` };
    const claimIds = [...new Set(p.claimIds)];
    const cited = claimIds.map((id) => toCited(byId.get(id)!));
    const ownEvidence = approved.filter((c) => claimIds.includes(c.id)).flatMap((c) => c.evidence.map((e) => e.id));
    const evidenceIds = p.evidenceIds.length
      ? p.evidenceIds.filter((id) => claimIds.includes(evidenceOwner.get(id)!))
      : ownEvidence;
    const support = cited.length ? capSupport(p.support, supportCeiling(cited)) : "unknown";
    const limits = [...new Set([...derivedLimits(cited), ...p.limits.map((l) => l.trim()).filter((l) => l && l.length <= 300).slice(0, 3)])];
    if (support !== p.support) limits.push(`Capped at ${support}: the cited claims cannot carry ${p.support}.`);
    return {
      ok: true,
      cap: {
        key,
        name: p.name,
        support,
        claimRefs: cited.map((c) => ({ claimId: c.id, revision: c.revision })),
        evidenceIds,
        limits,
      },
    };
  };
}

/**
 * The model (or the fixture rules) only proposes. A citation to an unknown or unapproved ID discards the
 * item, support is capped by what the cited claims can carry, and limits are derived from the ledger.
 */
export function validateProposal(
  proposal: ProposedCapabilities,
  approved: LedgerClaim[],
  meta: { engine: string; ledgerRevision: number; now: number },
): StoredProjection {
  const check = makeChecker(approved);
  const discarded: StoredProjection["discarded"] = [];
  const capabilities: StoredCapability[] = [];

  proposal.capabilities.slice(0, LIMITS.capabilities).forEach((p, i) => {
    const r = check(p, `cap-${i + 1}`);
    if (r.ok) capabilities.push(r.cap);
    else discarded.push({ name: p.name, reason: r.reason });
  });

  let nextBuild: StoredNextBuild | null = null;
  if (proposal.nextBuild) {
    const gaps = [...proposal.nextBuild.gaps];
    const parts: StoredCapability[] = [];
    proposal.nextBuild.parts.slice(0, 5).forEach((p, i) => {
      const r = check({ ...p, support: "demonstrated", limits: [] }, `part-${i + 1}`);
      if (r.ok && r.cap.claimRefs.length) parts.push(r.cap);
      else if (!r.ok) discarded.push({ name: p.name, reason: r.reason });
    });
    if (parts.length) nextBuild = { title: proposal.nextBuild.title.slice(0, 120), summary: proposal.nextBuild.summary.slice(0, 400), parts, gaps: gaps.slice(0, 3) };
  }

  return {
    generatedAt: meta.now,
    ledgerRevision: meta.ledgerRevision,
    engine: meta.engine,
    capabilities,
    gaps: proposal.gaps.map((x) => x.trim()).filter(Boolean).slice(0, 3),
    question: proposal.question?.trim() ? proposal.question.trim() : null,
    discarded,
    nextBuild,
  };
}
