import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import { contentHash, hashToken, newId, newToken } from "@/lib/auth";
import type { Attribution, Audience, ImportReport, Mode, StoredProjection } from "@/lib/domain/types";
import { LIMITS } from "@/lib/domain/types";
import { deriveClaimState, normalizeForQuote, quoteIsLiteral, type Identity, type SourceFacts } from "@/lib/domain/rules";
import type { FetchedSource } from "@/lib/ingest/types";
import type { ClaimProposal, StoredSourceForPrompt } from "@/lib/claims/propose";
import type { LedgerClaim, ProposedCapabilities } from "@/lib/capabilities/types";
import { validateProposal } from "@/lib/capabilities/validate";

export type ProjectInput = { title: string; role: string | null; urls: { url: string; ownPage?: boolean }[] };

export type Deps = {
  fetchSources(url: string, ownPage: boolean, allUrls: string[], who: Identity): Promise<FetchedSource[]>;
  proposeClaims(input: {
    projectTitle: string;
    role: string | null;
    who: Identity;
    sources: StoredSourceForPrompt[];
  }): Promise<ClaimProposal>;
  inferCapabilities(goal: string, claims: LedgerClaim[]): Promise<{ proposal: ProposedCapabilities; engine: string }>;
  now(): number;
};

export type ImportEvent =
  | { type: "project"; projectId: string; title: string }
  | { type: "source"; projectId: string; url: string; locator: string; status: string; statusDetail: string; unchanged: boolean }
  | { type: "claims"; projectId: string; kept: number; report: ImportReport }
  | { type: "error"; message: string }
  | { type: "done"; ledgerRevision: number };

export class OwnerError extends Error {}

export function createWorkspace(db: Db, input: { personName: string; githubHandle: string; mode: Mode }, now = Date.now()) {
  const workspaceId = newId("ws");
  const token = newToken();
  db.insert(t.workspaces)
    .values({ id: workspaceId, personName: input.personName, githubHandle: input.githubHandle.replace(/^@/, ""), mode: input.mode, createdAt: now })
    .run();
  db.insert(t.sessions).values({ id: newId("ses"), workspaceId, tokenHash: hashToken(token), createdAt: now }).run();
  return { workspaceId, token };
}

/** The only way to get a writable workspace. Callers pass the raw cookie value. */
export function ownerWorkspace(db: Db, sessionToken: string | null) {
  if (!sessionToken) return null;
  const s = db.select().from(t.sessions).where(eq(t.sessions.tokenHash, hashToken(sessionToken))).get();
  if (!s) return null;
  return db.select().from(t.workspaces).where(eq(t.workspaces.id, s.workspaceId)).get() ?? null;
}

function requireOwner(db: Db, sessionToken: string | null) {
  const ws = ownerWorkspace(db, sessionToken);
  if (!ws) throw new OwnerError("Owner session required");
  return ws;
}

function bumpLedger(db: Db, workspaceId: string): number {
  const ws = db.select().from(t.workspaces).where(eq(t.workspaces.id, workspaceId)).get()!;
  const next = ws.ledgerRevision + 1;
  db.update(t.workspaces).set({ ledgerRevision: next }).where(eq(t.workspaces.id, workspaceId)).run();
  return next;
}

function toFacts(s: typeof t.sources.$inferSelect): SourceFacts {
  return { id: s.id, url: s.url, kind: s.kind, text: s.snippetStore, meta: s.meta ?? null, authorship: s.authorship ?? null };
}

export async function importProjects(
  db: Db,
  sessionToken: string | null,
  inputs: ProjectInput[],
  deps: Deps,
  emit: (e: ImportEvent) => void = () => {},
) {
  const ws = requireOwner(db, sessionToken);
  const who: Identity = { handle: ws.githubHandle, personName: ws.personName };
  const existing = db.select().from(t.projects).where(eq(t.projects.workspaceId, ws.id)).all();

  for (const [index, input] of inputs.slice(0, LIMITS.projects).entries()) {
    let project = existing.find((p) => p.title === input.title);
    if (!project && existing.length >= LIMITS.projects) {
      emit({ type: "error", message: `Budget: at most ${LIMITS.projects} projects. "${input.title}" was not imported.` });
      continue;
    }
    if (!project) {
      project = {
        id: newId("prj"),
        workspaceId: ws.id,
        position: index,
        title: input.title,
        role: input.role,
        urls: input.urls.map((u) => u.url),
        claimCalls: 0,
        claimInputHash: null,
        questions: [],
        report: null,
      };
      db.insert(t.projects).values(project).run();
      existing.push(project);
    } else {
      db.update(t.projects).set({ role: input.role, urls: input.urls.map((u) => u.url) }).where(eq(t.projects.id, project.id)).run();
    }
    emit({ type: "project", projectId: project.id, title: project.title });

    const allUrls = input.urls.map((u) => u.url);
    const fetched: FetchedSource[] = [];
    for (const u of input.urls) fetched.push(...(await deps.fetchSources(u.url, !!u.ownPage, allUrls, who)));
    const kept = fetched.slice(0, LIMITS.sourcesPerProject);
    const skippedSources = fetched
      .slice(LIMITS.sourcesPerProject)
      .map((s) => ({ url: s.url, locator: s.locator, reason: `Budget: ${LIMITS.sourcesPerProject} sources per project` }));

    const stored: (typeof t.sources.$inferSelect)[] = [];
    for (const f of kept) {
      const hash = contentHash(`${f.status}\n${f.text}`);
      const prev = db
        .select()
        .from(t.sources)
        .where(and(eq(t.sources.projectId, project.id), eq(t.sources.url, f.url), eq(t.sources.locator, f.locator)))
        .get();
      const unchanged = prev?.contentHash === hash;
      const row = {
        id: prev?.id ?? newId("src"),
        projectId: project.id,
        url: f.url,
        locator: f.locator,
        kind: f.kind,
        status: f.status,
        statusDetail: f.statusDetail,
        fetchedAt: unchanged ? prev!.fetchedAt : deps.now(),
        contentHash: hash,
        snippetStore: f.text.slice(0, 200_000),
        meta: f.meta ?? null,
        authorship: f.authorship ?? null,
      };
      if (!prev) db.insert(t.sources).values(row).run();
      else if (!unchanged) db.update(t.sources).set(row).where(eq(t.sources.id, prev.id)).run();
      stored.push(row);
      emit({ type: "source", projectId: project.id, url: f.url, locator: f.locator, status: f.status, statusDetail: f.statusDetail, unchanged });
    }

    const usable = stored.filter((s) => s.status === "ok" && s.snippetStore.trim());
    const inputHash = contentHash(usable.map((s) => `${s.id}:${s.contentHash}`).sort().join("|"));
    const current = db.select().from(t.projects).where(eq(t.projects.id, project.id)).get()!;

    if (current.claimInputHash === inputHash && current.report) {
      emit({ type: "claims", projectId: project.id, kept: countClaims(db, project.id), report: { ...current.report, llmCalled: false } });
      continue;
    }
    if (!usable.length) {
      const report: ImportReport = { engine: "none", llmCalled: false, discarded: [], heldBack: [], skippedSources };
      db.update(t.projects).set({ report, claimInputHash: inputHash }).where(eq(t.projects.id, project.id)).run();
      emit({ type: "claims", projectId: project.id, kept: countClaims(db, project.id), report });
      continue;
    }

    let proposal: ClaimProposal;
    try {
      proposal = await deps.proposeClaims({
        projectTitle: project.title,
        role: project.role,
        who,
        sources: usable.map((s) => ({ id: s.id, url: s.url, locator: s.locator, kind: s.kind, text: s.snippetStore })),
      });
    } catch (err) {
      emit({ type: "error", message: `Claims for "${project.title}" failed: ${(err as Error).message}` });
      continue;
    }
    const report = commitProposal(db, project.id, proposal, usable, who, deps.now());
    report.skippedSources = skippedSources;
    db.update(t.projects)
      .set({
        report,
        claimInputHash: inputHash,
        claimCalls: current.claimCalls + 1,
        questions: proposal.questions.slice(0, LIMITS.questionsPerProject),
      })
      .where(eq(t.projects.id, project.id))
      .run();
    emit({ type: "claims", projectId: project.id, kept: countClaims(db, project.id), report });
  }

  emit({ type: "done", ledgerRevision: bumpLedger(db, ws.id) });
}

function countClaims(db: Db, projectId: string) {
  return db.select().from(t.claims).where(eq(t.claims.projectId, projectId)).all().length;
}

export function claimKey(text: string) {
  return contentHash(normalizeForQuote(text).toLowerCase());
}

/** Writes model or recorded proposals into the ledger. Human-reviewed claims are never overwritten or removed. */
export function commitProposal(
  db: Db,
  projectId: string,
  proposal: ClaimProposal,
  sources: (typeof t.sources.$inferSelect)[],
  who: Identity,
  now: number,
): ImportReport {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const report: ImportReport = { engine: proposal.engine, llmCalled: proposal.engine.startsWith("model:"), discarded: [], heldBack: [], skippedSources: [] };
  const seen = new Set<string>();
  const origin = proposal.engine.startsWith("model:") ? ("model" as const) : ("fixture" as const);

  for (const c of proposal.claims.slice(0, LIMITS.claimsPerProject)) {
    const literal = c.quotes.filter((q) => {
      const s = byId.get(q.sourceId);
      return !!s && quoteIsLiteral(q.quote, s.snippetStore);
    });
    if (!literal.length) {
      report.discarded.push({ text: c.text, reason: c.quotes.length ? "Its quote is not in the cited source, word for word." : "It cited no source." });
      continue;
    }
    const st = deriveClaimState({
      kind: c.kind,
      attribution: c.attribution,
      origin,
      quotes: literal.map((q) => ({ quote: q.quote, source: toFacts(byId.get(q.sourceId)!) })),
      who,
    });
    if (st.heldBack) report.heldBack.push({ text: c.text, reason: st.heldBack });

    const dedupKey = claimKey(c.text);
    seen.add(dedupKey);
    const prev = db.select().from(t.claims).where(and(eq(t.claims.projectId, projectId), eq(t.claims.dedupKey, dedupKey))).get();
    if (prev?.humanReviewed) continue;

    const fields = {
      text: c.text,
      kind: c.kind,
      state: st.state,
      attribution: st.attribution,
      attributionNote: st.heldBack,
      legalFlag: c.legalFlag,
      tags: c.tags,
      updatedAt: now,
    };
    const claimId = prev?.id ?? newId("clm");
    if (prev) {
      db.update(t.claims).set(fields).where(eq(t.claims.id, prev.id)).run();
      db.delete(t.evidence).where(eq(t.evidence.claimId, prev.id)).run();
    } else {
      db.insert(t.claims)
        .values({ id: claimId, projectId, dedupKey, reviewStatus: "proposed", revision: 1, publishable: true, origin, humanReviewed: false, createdAt: now, ...fields })
        .run();
    }
    literal.forEach((q, i) => {
      const s = byId.get(q.sourceId)!;
      db.insert(t.evidence)
        .values({ id: newId("ev"), claimId, sourceId: s.id, quote: q.quote, locator: s.locator, supportScore: st.backing[i] ? "direct" : "context" })
        .run();
    });
  }

  const stale = db
    .select()
    .from(t.claims)
    .where(and(eq(t.claims.projectId, projectId), eq(t.claims.humanReviewed, false)))
    .all()
    .filter((c) => c.origin !== "owner" && !seen.has(c.dedupKey));
  if (stale.length) {
    const ids = stale.map((c) => c.id);
    db.delete(t.evidence).where(inArray(t.evidence.claimId, ids)).run();
    db.delete(t.claims).where(inArray(t.claims.id, ids)).run();
  }
  return report;
}

function ownedClaim(db: Db, workspaceId: string, claimId: string) {
  const claim = db.select().from(t.claims).where(eq(t.claims.id, claimId)).get();
  const project = claim && db.select().from(t.projects).where(eq(t.projects.id, claim.projectId)).get();
  if (!claim || !project || project.workspaceId !== workspaceId) throw new OwnerError("Claim not found in this workspace");
  return claim;
}

export type ClaimReview =
  | { action: "approve" }
  | { action: "reject"; note?: string }
  | { action: "correct"; text?: string; attribution?: Attribution; attributionNote?: string; note?: string }
  | { action: "publishable"; publishable: boolean };

export function reviewClaim(db: Db, sessionToken: string | null, claimId: string, review: ClaimReview, now = Date.now()) {
  const ws = requireOwner(db, sessionToken);
  const claim = ownedClaim(db, ws.id, claimId);
  const before = { text: claim.text, attribution: claim.attribution, state: claim.state, reviewStatus: claim.reviewStatus, revision: claim.revision, publishable: claim.publishable };
  let patch: Partial<typeof t.claims.$inferInsert> = { humanReviewed: true, updatedAt: now };

  if (review.action === "approve") patch.reviewStatus = "approved";
  if (review.action === "reject") patch.reviewStatus = "rejected";
  if (review.action === "publishable") patch.publishable = review.publishable;
  if (review.action === "correct") {
    const text = review.text?.trim() || claim.text;
    const attribution = review.attribution ?? claim.attribution;
    const textChanged = text !== claim.text;
    let state = claim.state;
    if (textChanged) state = "user_attested";
    else if (attribution !== claim.attribution) {
      const ev = db.select().from(t.evidence).where(eq(t.evidence.claimId, claim.id)).all();
      const srcs = ev.length ? db.select().from(t.sources).where(inArray(t.sources.id, ev.map((e) => e.sourceId))).all() : [];
      state = deriveClaimState({
        kind: claim.kind,
        attribution,
        origin: "owner",
        quotes: ev.map((e) => ({ quote: e.quote, source: toFacts(srcs.find((s) => s.id === e.sourceId)!) })),
        who: { handle: ws.githubHandle, personName: ws.personName },
      }).state;
    }
    patch = {
      ...patch,
      text,
      attribution,
      attributionNote: review.attributionNote?.trim() || (attribution === claim.attribution ? claim.attributionNote : null),
      state,
      reviewStatus: "approved",
      revision: claim.revision + 1,
    };
  }

  db.update(t.claims).set(patch).where(eq(t.claims.id, claim.id)).run();
  const ledgerRevision = bumpLedger(db, ws.id);
  const after = db.select().from(t.claims).where(eq(t.claims.id, claim.id)).get()!;
  db.insert(t.reviews)
    .values({
      id: newId("rev"),
      workspaceId: ws.id,
      targetKind: "claim",
      targetId: claim.id,
      action: review.action === "publishable" ? "correct" : review.action,
      before,
      after: { text: after.text, attribution: after.attribution, state: after.state, reviewStatus: after.reviewStatus, revision: after.revision, publishable: after.publishable },
      note: "note" in review ? (review.note ?? null) : null,
      ledgerRevision,
      createdAt: now,
    })
    .run();
  return after;
}

export function attestClaim(db: Db, sessionToken: string | null, projectId: string, text: string, now = Date.now()) {
  const ws = requireOwner(db, sessionToken);
  const project = db.select().from(t.projects).where(eq(t.projects.id, projectId)).get();
  if (!project || project.workspaceId !== ws.id) throw new OwnerError("Project not found in this workspace");
  const id = newId("clm");
  db.insert(t.claims)
    .values({
      id,
      projectId,
      dedupKey: claimKey(text),
      text: text.trim(),
      kind: "contribution",
      state: "user_attested",
      reviewStatus: "approved",
      revision: 1,
      attribution: "author",
      attributionNote: null,
      publishable: true,
      legalFlag: null,
      tags: [],
      origin: "owner",
      humanReviewed: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const ledgerRevision = bumpLedger(db, ws.id);
  db.insert(t.reviews)
    .values({ id: newId("rev"), workspaceId: ws.id, targetKind: "claim", targetId: id, action: "attest", before: null, after: { text }, note: null, ledgerRevision, createdAt: now })
    .run();
  return id;
}

export function setGoal(db: Db, sessionToken: string | null, text: string, now = Date.now()) {
  const ws = requireOwner(db, sessionToken);
  const clean = text.trim().slice(0, 200);
  if (!clean) throw new OwnerError("Goal is empty");
  db.delete(t.goals).where(eq(t.goals.workspaceId, ws.id)).run();
  const id = newId("goal");
  db.insert(t.goals).values({ id, workspaceId: ws.id, text: clean, projection: null, inferenceCalls: 0, createdAt: now }).run();
  return id;
}

export function approvedLedger(db: Db, workspaceId: string): LedgerClaim[] {
  const projects = db.select().from(t.projects).where(eq(t.projects.workspaceId, workspaceId)).all();
  if (!projects.length) return [];
  const claims = db
    .select()
    .from(t.claims)
    .where(and(inArray(t.claims.projectId, projects.map((p) => p.id)), eq(t.claims.reviewStatus, "approved")))
    .all();
  if (!claims.length) return [];
  const ev = db.select().from(t.evidence).where(inArray(t.evidence.claimId, claims.map((c) => c.id))).all();
  const srcs = ev.length ? db.select().from(t.sources).where(inArray(t.sources.id, [...new Set(ev.map((e) => e.sourceId))])).all() : [];
  return claims.map((c) => ({
    id: c.id,
    projectId: c.projectId,
    projectTitle: projects.find((p) => p.id === c.projectId)!.title,
    text: c.text,
    kind: c.kind,
    state: c.state,
    attribution: c.attribution,
    attributionNote: c.attributionNote,
    revision: c.revision,
    tags: c.tags,
    publishable: c.publishable,
    legalFlag: c.legalFlag,
    evidence: ev
      .filter((e) => e.claimId === c.id)
      .map((e) => ({ id: e.id, sourceId: e.sourceId, quote: e.quote, locator: e.locator, supportScore: e.supportScore, sourceUrl: srcs.find((s) => s.id === e.sourceId)?.url ?? "" })),
  }));
}

/** One inference per goal per ledger revision: re-asking with nothing changed returns the stored answer without a call. */
export async function evaluateGoal(db: Db, sessionToken: string | null, deps: Deps): Promise<StoredProjection> {
  const ws = requireOwner(db, sessionToken);
  const goal = db.select().from(t.goals).where(eq(t.goals.workspaceId, ws.id)).get();
  if (!goal) throw new OwnerError("Set a goal first");
  if (goal.projection && goal.projection.ledgerRevision === ws.ledgerRevision) return goal.projection;
  const ledger = approvedLedger(db, ws.id);
  const { proposal, engine } = await deps.inferCapabilities(goal.text, ledger);
  const projection = validateProposal(proposal, ledger, { engine, ledgerRevision: ws.ledgerRevision, now: deps.now() });
  db.update(t.goals).set({ projection, inferenceCalls: goal.inferenceCalls + 1 }).where(eq(t.goals.id, goal.id)).run();
  return projection;
}

export function reviewReading(
  db: Db,
  sessionToken: string | null,
  capabilityKey: string,
  action: "reject_reading" | "confirm_reading",
  note: string | null,
  now = Date.now(),
) {
  const ws = requireOwner(db, sessionToken);
  const goal = db.select().from(t.goals).where(eq(t.goals.workspaceId, ws.id)).get();
  const cap = goal?.projection?.capabilities.find((c) => c.key === capabilityKey);
  if (!goal || !cap) throw new OwnerError("Capability not found");
  const ledgerRevision = bumpLedger(db, ws.id);
  db.insert(t.reviews)
    .values({ id: newId("rev"), workspaceId: ws.id, targetKind: "capability", targetId: `${goal.id}:${cap.name}`, action, before: { support: cap.support }, after: null, note, ledgerRevision, createdAt: now })
    .run();
}

export function createPresentation(db: Db, sessionToken: string | null, audience: Audience, now = Date.now()) {
  const ws = requireOwner(db, sessionToken);
  const token = newToken();
  const id = newId("pres");
  db.insert(t.presentations)
    .values({ id, workspaceId: ws.id, audience, selectedClaimIds: null, sourceRevision: ws.ledgerRevision, tokenHash: hashToken(token), createdAt: now, revokedAt: null })
    .run();
  return { id, token };
}

export function revokePresentation(db: Db, sessionToken: string | null, presentationId: string, now = Date.now()) {
  const ws = requireOwner(db, sessionToken);
  db.update(t.presentations)
    .set({ revokedAt: now })
    .where(and(eq(t.presentations.id, presentationId), eq(t.presentations.workspaceId, ws.id)))
    .run();
}

/** Read-only access: a token opens exactly one presentation, and nothing once revoked. */
export function resolvePresentation(db: Db, token: string) {
  if (!token || token.length < 16) return null;
  const p = db.select().from(t.presentations).where(eq(t.presentations.tokenHash, hashToken(token))).get();
  if (!p || p.revokedAt) return null;
  return p;
}
