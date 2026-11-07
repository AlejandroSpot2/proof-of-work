import { eq, inArray, desc } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import type { StoredCapability, Support } from "@/lib/domain/types";

export function loadSnapshot(db: Db, workspaceId: string) {
  const workspace = db.select().from(t.workspaces).where(eq(t.workspaces.id, workspaceId)).get();
  if (!workspace) return null;
  const projects = db.select().from(t.projects).where(eq(t.projects.workspaceId, workspaceId)).all().sort((a, b) => a.position - b.position);
  const pids = projects.map((p) => p.id);
  const sources = pids.length ? db.select().from(t.sources).where(inArray(t.sources.projectId, pids)).all() : [];
  const claims = pids.length ? db.select().from(t.claims).where(inArray(t.claims.projectId, pids)).all() : [];
  const evidence = claims.length ? db.select().from(t.evidence).where(inArray(t.evidence.claimId, claims.map((c) => c.id))).all() : [];
  const goal = db.select().from(t.goals).where(eq(t.goals.workspaceId, workspaceId)).get() ?? null;
  const reviews = db.select().from(t.reviews).where(eq(t.reviews.workspaceId, workspaceId)).orderBy(desc(t.reviews.createdAt)).all();
  const presentations = db.select().from(t.presentations).where(eq(t.presentations.workspaceId, workspaceId)).all();

  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const claimRows = claims
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => ({
      ...c,
      evidence: evidence
        .filter((e) => e.claimId === c.id)
        .map((e) => {
          const s = sourceById.get(e.sourceId);
          return { ...e, sourceUrl: s?.url ?? "", fetchedAt: s?.fetchedAt ?? 0, contentHash: s?.contentHash ?? "" };
        }),
    }));

  return {
    workspace,
    projects: projects.map((p) => ({
      ...p,
      sources: sources.filter((s) => s.projectId === p.id).map(({ snippetStore, ...s }) => ({ ...s, chars: snippetStore.length })),
      claims: claimRows.filter((c) => c.projectId === p.id),
    })),
    goal,
    reviews,
    presentations: presentations.map(({ tokenHash: _h, ...p }) => p),
  };
}

export type Snapshot = NonNullable<ReturnType<typeof loadSnapshot>>;
export type SnapshotClaim = Snapshot["projects"][number]["claims"][number];

export type ResolvedEvidence = {
  id: string;
  quote: string;
  locator: string;
  sourceUrl: string;
  claimId: string;
  claimText: string;
  projectTitle: string;
  publishable: boolean;
};

export type ResolvedCapability = {
  key: string;
  name: string;
  support: Support;
  limits: string[];
  claims: { id: string; text: string; projectTitle: string; state: string; attribution: string; revision: number; publishable: boolean }[];
  evidence: ResolvedEvidence[];
};

export type Entrust = {
  goal: string | null;
  status: "no-goal" | "not-evaluated" | "current" | "ledger-changed";
  engine: string | null;
  capabilities: ResolvedCapability[];
  withdrawn: { name: string; reason: string }[];
  discarded: { name: string; reason: string }[];
  gaps: string[];
  question: string | null;
  nextBuild: { title: string; summary: string; parts: ResolvedCapability[]; gaps: string[] } | null;
};

/**
 * A stored capability is live only while every claim it cites is still approved at the revision it cited.
 * Anything else is withdrawn from every view at once, because every view reads this one function.
 */
export function deriveEntrust(s: Snapshot): Entrust {
  const goal = s.goal;
  const empty: Entrust = { goal: goal?.text ?? null, status: goal ? "not-evaluated" : "no-goal", engine: null, capabilities: [], withdrawn: [], discarded: [], gaps: [], question: null, nextBuild: null };
  if (!goal || !goal.projection) return empty;
  const p = goal.projection;
  const claims = new Map(s.projects.flatMap((pr) => pr.claims.map((c) => [c.id, { ...c, projectTitle: pr.title }] as const)));
  const rejected = new Map<string, string>();
  for (const r of [...s.reviews].reverse()) {
    if (r.targetKind !== "capability" || !r.targetId.startsWith(`${goal.id}:`)) continue;
    const name = r.targetId.slice(goal.id.length + 1);
    if (r.action === "reject_reading") rejected.set(name, r.note ? `Reading rejected by a reviewer: ${r.note}` : "Reading rejected by a reviewer.");
    if (r.action === "confirm_reading") rejected.delete(name);
  }

  const withdrawn: Entrust["withdrawn"] = [];
  const resolve = (cap: StoredCapability): ResolvedCapability | null => {
    for (const ref of cap.claimRefs) {
      const c = claims.get(ref.claimId);
      if (!c) return withdraw(cap, "A claim it cited no longer exists.");
      if (c.reviewStatus !== "approved") return withdraw(cap, `"${c.text}" is no longer approved.`);
      if (c.revision !== ref.revision) return withdraw(cap, `"${c.text}" was corrected (rev ${ref.revision} → rev ${c.revision}).`);
    }
    if (rejected.has(cap.name)) return withdraw(cap, rejected.get(cap.name)!);
    const cited = cap.claimRefs.map((r) => claims.get(r.claimId)!);
    return {
      key: cap.key,
      name: cap.name,
      support: cap.support,
      limits: cap.limits,
      claims: cited.map((c) => ({ id: c.id, text: c.text, projectTitle: c.projectTitle, state: c.state, attribution: c.attribution, revision: c.revision, publishable: c.publishable })),
      evidence: cited.flatMap((c) =>
        c.evidence
          .filter((e) => cap.evidenceIds.includes(e.id))
          .map((e) => ({ id: e.id, quote: e.quote, locator: e.locator, sourceUrl: e.sourceUrl, claimId: c.id, claimText: c.text, projectTitle: c.projectTitle, publishable: c.publishable })),
      ),
    };
  };
  function withdraw(cap: StoredCapability, reason: string): null {
    withdrawn.push({ name: cap.name, reason });
    return null;
  }

  const capabilities = p.capabilities.map(resolve).filter((c): c is ResolvedCapability => !!c);
  const parts = p.nextBuild?.parts.map(resolve).filter((c): c is ResolvedCapability => !!c) ?? [];
  return {
    goal: goal.text,
    status: p.ledgerRevision === s.workspace.ledgerRevision ? "current" : "ledger-changed",
    engine: p.engine,
    capabilities,
    withdrawn,
    discarded: p.discarded,
    gaps: p.gaps,
    question: p.question,
    nextBuild: p.nextBuild && parts.length ? { title: p.nextBuild.title, summary: p.nextBuild.summary, parts, gaps: p.nextBuild.gaps } : null,
  };
}

const isExample = (s: Snapshot) => s.workspace.mode === "fixture";

/** Client / founding-engineer portfolio: approved, publishable facts only. No legal flags, no review log. */
export function portfolioView(s: Snapshot) {
  const entrust = deriveEntrust(s);
  const publicCap = (c: ResolvedCapability) => ({ ...c, evidence: c.evidence.filter((e) => e.publishable), claims: c.claims.filter((x) => x.publishable) });
  return {
    audience: "portfolio" as const,
    example: isExample(s),
    person: { name: s.workspace.personName, handle: s.workspace.githubHandle },
    ledgerRevision: s.workspace.ledgerRevision,
    goal: entrust.goal,
    capabilities: entrust.capabilities.map(publicCap),
    gaps: entrust.gaps,
    question: entrust.question,
    nextBuild: entrust.nextBuild && { ...entrust.nextBuild, parts: entrust.nextBuild.parts.map(publicCap) },
    projects: s.projects.map((p) => ({
      title: p.title,
      role: p.role,
      claims: p.claims
        .filter((c) => c.reviewStatus === "approved" && c.publishable)
        .map((c) => ({ id: c.id, text: c.text, state: c.state, attribution: c.attribution, evidence: c.evidence.map((e) => ({ id: e.id, quote: e.quote, locator: e.locator, sourceUrl: e.sourceUrl })) })),
    })),
  };
}

export const NO_ELIGIBILITY =
  "No eligibility assessment. This dossier organizes sources for an attorney's own review. It does not assess any visa category, predict an outcome, or give legal advice.";

/** Private attorney-review dossier: the same facts plus states, attribution, provenance, review log and open questions. */
export function attorneyView(s: Snapshot) {
  const entrust = deriveEntrust(s);
  const approved = s.projects.flatMap((p) => p.claims.filter((c) => c.reviewStatus === "approved").map((c) => ({ ...c, projectTitle: p.title })));
  const documented = approved.filter((c) => c.state === "fetched" || c.state === "corroborated");
  const selfOnly = approved.filter((c) => c.state === "user_attested" || c.state === "unverified");
  const shared = approved.filter((c) => c.attribution === "co_author" || c.attribution === "contributor");
  const corrections = s.reviews.filter((r) => r.targetKind === "claim" && r.action === "correct");

  const questions: string[] = [];
  if (documented.length)
    questions.push(
      `${documented.length} approved claim${documented.length === 1 ? " is" : "s are"} backed by quoted sources. Which of those sources count as independent documentation for your purposes?`,
    );
  for (const c of selfOnly) questions.push(`This rests on the builder's own word: "${c.text}". What documentation would you need for it, if any?`);
  for (const c of shared) questions.push(`This is shared work: "${c.text}". How should the builder's part be described?`);
  if (corrections.length) questions.push(`The builder corrected ${corrections.length} claim${corrections.length === 1 ? "" : "s"} (see the review log). Should corrected claims be presented, and how?`);
  if (entrust.gaps.length) questions.push(`Gaps in the evidence: ${entrust.gaps.join(" ")} Do any of these matter for the case you are considering?`);

  return {
    audience: "attorney" as const,
    example: isExample(s),
    disclaimer: NO_ELIGIBILITY,
    person: { name: s.workspace.personName, handle: s.workspace.githubHandle },
    ledgerRevision: s.workspace.ledgerRevision,
    goal: entrust.goal,
    capabilities: entrust.capabilities,
    withdrawn: entrust.withdrawn,
    gaps: entrust.gaps,
    nextBuild: entrust.nextBuild,
    projects: s.projects.map((p) => ({
      title: p.title,
      role: p.role,
      sources: p.sources,
      report: p.report,
      claims: p.claims.filter((c) => c.reviewStatus === "approved"),
      notApproved: p.claims.filter((c) => c.reviewStatus !== "approved").map((c) => ({ text: c.text, reviewStatus: c.reviewStatus })),
    })),
    attorneyAttention: approved.filter((c) => c.legalFlag).map((c) => ({ claimId: c.id, text: c.text, suggestion: c.legalFlag! })),
    reviewLog: s.reviews.map((r) => ({ id: r.id, action: r.action, targetKind: r.targetKind, before: r.before, after: r.after, note: r.note, ledgerRevision: r.ledgerRevision, createdAt: r.createdAt })),
    questions,
  };
}

export type PortfolioView = ReturnType<typeof portfolioView>;
export type AttorneyView = ReturnType<typeof attorneyView>;
