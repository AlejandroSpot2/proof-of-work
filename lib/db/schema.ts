import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import type {
  Attribution,
  ClaimKind,
  ClaimState,
  ReviewStatus,
  EvidenceSupport,
  Audience,
  Mode,
  StoredProjection,
  ReviewAction,
  ImportReport,
} from "@/lib/domain/types";
import type { SourceKind, SourceStatus, GithubMeta, Authorship } from "@/lib/ingest/types";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  personName: text("person_name").notNull(),
  githubHandle: text("github_handle").notNull(),
  mode: text("mode").$type<Mode>().notNull(),
  ledgerRevision: integer("ledger_revision").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  role: text("role"),
  urls: text("urls", { mode: "json" }).$type<string[]>().notNull(),
  claimCalls: integer("claim_calls").notNull().default(0),
  claimInputHash: text("claim_input_hash"),
  questions: text("questions", { mode: "json" }).$type<string[]>().notNull(),
  report: text("report", { mode: "json" }).$type<ImportReport | null>(),
});

export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    url: text("url").notNull(),
    locator: text("locator").notNull(),
    kind: text("kind").$type<SourceKind>().notNull(),
    status: text("status").$type<SourceStatus>().notNull(),
    statusDetail: text("status_detail").notNull(),
    fetchedAt: integer("fetched_at").notNull(),
    contentHash: text("content_hash").notNull(),
    snippetStore: text("snippet_store").notNull(),
    meta: text("meta", { mode: "json" }).$type<GithubMeta | null>(),
    authorship: text("authorship").$type<Authorship | null>(),
  },
  (t) => [uniqueIndex("sources_project_url_locator").on(t.projectId, t.url, t.locator)],
);

export const claims = sqliteTable(
  "claims",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    dedupKey: text("dedup_key").notNull(),
    text: text("text").notNull(),
    kind: text("kind").$type<ClaimKind>().notNull(),
    state: text("state").$type<ClaimState>().notNull(),
    reviewStatus: text("review_status").$type<ReviewStatus>().notNull(),
    revision: integer("revision").notNull().default(1),
    attribution: text("attribution").$type<Attribution>().notNull(),
    attributionNote: text("attribution_note"),
    publishable: integer("publishable", { mode: "boolean" }).notNull().default(true),
    legalFlag: text("legal_flag"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    origin: text("origin").$type<"model" | "fixture" | "owner">().notNull(),
    humanReviewed: integer("human_reviewed", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("claims_project_dedup").on(t.projectId, t.dedupKey)],
);

export const evidence = sqliteTable("evidence", {
  id: text("id").primaryKey(),
  claimId: text("claim_id").notNull(),
  sourceId: text("source_id").notNull(),
  quote: text("quote").notNull(),
  locator: text("locator").notNull(),
  supportScore: text("support_score").$type<EvidenceSupport>().notNull(),
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  text: text("text").notNull(),
  projection: text("projection", { mode: "json" }).$type<StoredProjection | null>(),
  inferenceCalls: integer("inference_calls").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  targetKind: text("target_kind").$type<"claim" | "capability">().notNull(),
  targetId: text("target_id").notNull(),
  action: text("action").$type<ReviewAction>().notNull(),
  before: text("before", { mode: "json" }).$type<Record<string, unknown> | null>(),
  after: text("after", { mode: "json" }).$type<Record<string, unknown> | null>(),
  note: text("note"),
  ledgerRevision: integer("ledger_revision").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const presentations = sqliteTable("presentations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  audience: text("audience").$type<Audience>().notNull(),
  selectedClaimIds: text("selected_claim_ids", { mode: "json" }).$type<string[] | null>(),
  sourceRevision: integer("source_revision").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at").notNull(),
  revokedAt: integer("revoked_at"),
});
