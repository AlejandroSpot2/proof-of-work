import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import * as t from "@/lib/db/schema";
import type { Mode } from "@/lib/domain/types";
import { contentWords, EXAMPLE_SIGNALS, liveSignal, VIEWS, type CallProvenance, type PublicRow, type Relevance, type Signal, type StoredRun, type View } from "@/lib/discover";
import {
  dbLedger,
  ENDPOINTS,
  MAX_RESULTS,
  normalizePeople,
  normalizePosts,
  parseRelevance,
  relevanceRequest,
  tregCall,
  tregSetup,
  type CallMeta,
  type EndpointId,
  type SpendLedger,
  type TregCtx,
} from "@/lib/treg";

export type DiscoverCtx = { workspaceId: string; ledger: SpendLedger };
export type Found = { signals: Signal[]; provenance: CallProvenance };

/** The Discover capability of Deps: a search, then a relevance label per result. Code rules run on the client over the real ledger. */
export type DiscoverDeps = {
  /** What answers this view. It is part of the cache key, so Demo and Live results can never meet. */
  source(view: View): string;
  search(view: View, query: string, ctx: DiscoverCtx): Promise<Found>;
  judge(query: string, signals: Signal[], ctx: DiscoverCtx): Promise<Relevance>;
};

export const EXAMPLE_SOURCE = "prepared EXAMPLE list";

/** Demo: the prepared EXAMPLE signals, unchanged, and no relevance model. */
export const fixtureDiscover: DiscoverDeps = {
  source: () => EXAMPLE_SOURCE,
  async search(view) {
    return { signals: EXAMPLE_SIGNALS[view].signals, provenance: { mode: "demo", source: EXAMPLE_SOURCE, provider: null, callId: null, costMicro: null, at: Date.now() } };
  },
  async judge() {
    return { status: "none", reason: "demo" };
  },
};

const SEARCH: Record<View, { endpoint: EndpointId; body: (q: string) => unknown; normalize: (body: unknown, servedBy: string | null) => PublicRow[] }> = {
  cofounders: { endpoint: "treg.people.search", body: (q) => ({ q, keywords: contentWords(q).slice(0, 8), limit: MAX_RESULTS }), normalize: normalizePeople },
  clients: { endpoint: "treg.x.search.posts", body: (q) => ({ q }), normalize: normalizePosts },
};

const provenanceOf = (m: CallMeta): CallProvenance => ({ mode: "live", source: m.endpoint, provider: m.servedBy, callId: m.callId, costMicro: m.costMicro, at: m.at });

/** Live: Treg search, then Jev through Treg for relevance. Every call is injectable, so tests never touch the network. */
export function tregDiscover(io: Pick<TregCtx, "env" | "fetch" | "now"> = {}): DiscoverDeps {
  return {
    source: (view) => SEARCH[view].endpoint,
    async search(view, query, ctx) {
      const s = SEARCH[view];
      const { body, meta } = await tregCall(s.endpoint, s.body(query), { ...io, ...ctx });
      return { signals: s.normalize(body, meta.servedBy).map((row, i) => liveSignal(view, row, i)), provenance: provenanceOf(meta) };
    },
    async judge(query, signals, ctx) {
      if (!signals.length) return { status: "none", reason: "no-signals" };
      const rows = signals.map((s) => ({ name: s.view === "cofounders" ? s.person.name : s.name, text: s.quote, location: s.location }));
      const { body, meta } = await tregCall("openrouter.ai-judge.decide", relevanceRequest(query, rows), { ...io, ...ctx });
      const labels = parseRelevance(body, rows.length);
      return { status: "labeled", labels: Object.fromEntries(signals.map((s, i) => [s.id, labels[i]!])), provenance: provenanceOf(meta) };
    },
  };
}

export type Spend = { capMicro: number; spentMicro: number };
export type DiscoverEvent =
  | { type: "search"; run: StoredRun; cached: boolean }
  | { type: "relevance"; relevance: Relevance }
  | { type: "done"; spend: Spend | null }
  | { type: "error"; message: string };

export const QUERY_MAX = 200;
export const normalizeQuery = (q: string) => q.replace(/\s+/g, " ").trim().slice(0, QUERY_MAX);
const cacheKey = (...parts: string[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");

/**
 * One press: the cached search for this workspace, mode, view, source and query, or one search call; then one relevance
 * call unless the press was cancelled. A search that was paid for is cached before anything else can fail, and a
 * relevance check that failed is tried again on the next press without paying for the search twice.
 */
export async function runDiscover(db: Db, ws: { id: string; mode: Mode }, view: View, query: string, deps: DiscoverDeps, emit: (e: DiscoverEvent) => void, cancelled: () => boolean = () => false) {
  const q = normalizeQuery(query);
  const source = deps.source(view);
  const key = cacheKey(ws.id, ws.mode, view, source, q.toLowerCase());
  const ctx: DiscoverCtx = { workspaceId: ws.id, ledger: dbLedger(db) };
  const hit = db.select().from(t.discoverResults).where(eq(t.discoverResults.key, key)).get();
  let run: StoredRun;
  if (hit) run = hit.run;
  else {
    const found = await deps.search(view, q, ctx);
    run = { view, query: q, signals: found.signals, search: found.provenance, relevance: null };
    db.insert(t.discoverResults).values({ key, workspaceId: ws.id, mode: ws.mode, view, query: q, source, run, createdAt: found.provenance.at }).run();
  }
  emit({ type: "search", run, cached: !!hit });
  if (run.relevance) return emit({ type: "relevance", relevance: run.relevance });

  let relevance: Relevance;
  if (cancelled()) relevance = { status: "none", reason: "cancelled" };
  else {
    try {
      relevance = await deps.judge(q, run.signals, ctx);
    } catch (err) {
      relevance = { status: "failed", message: (err as Error).message };
    }
  }
  if (relevance.status === "labeled" || (relevance.status === "none" && relevance.reason !== "cancelled")) {
    db.update(t.discoverResults).set({ run: { ...run, relevance } }).where(eq(t.discoverResults.key, key)).run();
  }
  emit({ type: "relevance", relevance });
}

export type DiscoverStatus =
  | { mode: "demo" }
  | { mode: "live"; ready: false; reason: string }
  | { mode: "live"; ready: true; spend: Spend; maxCostMicro: Record<View, number> };

export function discoverStatus(db: Db, mode: Mode, env: Record<string, string | undefined> = process.env): DiscoverStatus {
  if (mode === "fixture") return { mode: "demo" };
  const setup = tregSetup(env);
  if (!setup.ready) return { mode: "live", ready: false, reason: setup.reason };
  const maxCostMicro = Object.fromEntries(VIEWS.map((v) => [v, ENDPOINTS[SEARCH[v].endpoint].maxCostMicro + ENDPOINTS["openrouter.ai-judge.decide"].maxCostMicro])) as Record<View, number>;
  return { mode: "live", ready: true, spend: { capMicro: setup.config.capMicro, spentMicro: dbLedger(db).spentMicro() }, maxCostMicro };
}

/** The latest result per view for this workspace and mode, so a reload shows what was already paid for. */
export function latestRuns(db: Db, ws: { id: string; mode: Mode }): Record<View, StoredRun | null> {
  const rows = db
    .select()
    .from(t.discoverResults)
    .where(and(eq(t.discoverResults.workspaceId, ws.id), eq(t.discoverResults.mode, ws.mode)))
    .orderBy(desc(t.discoverResults.createdAt))
    .all();
  return { cofounders: rows.find((r) => r.view === "cofounders")?.run ?? null, clients: rows.find((r) => r.view === "clients")?.run ?? null };
}
