CREATE TABLE `claims` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`dedup_key` text NOT NULL,
	`text` text NOT NULL,
	`kind` text NOT NULL,
	`state` text NOT NULL,
	`review_status` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`attribution` text NOT NULL,
	`attribution_note` text,
	`publishable` integer DEFAULT true NOT NULL,
	`legal_flag` text,
	`tags` text NOT NULL,
	`origin` text NOT NULL,
	`human_reviewed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `claims_project_dedup` ON `claims` (`project_id`,`dedup_key`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`claim_id` text NOT NULL,
	`source_id` text NOT NULL,
	`quote` text NOT NULL,
	`locator` text NOT NULL,
	`support_score` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`text` text NOT NULL,
	`projection` text,
	`inference_calls` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `presentations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`audience` text NOT NULL,
	`selected_claim_ids` text,
	`source_revision` integer NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `presentations_token_hash_unique` ON `presentations` (`token_hash`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`role` text,
	`urls` text NOT NULL,
	`claim_calls` integer DEFAULT 0 NOT NULL,
	`claim_input_hash` text,
	`questions` text NOT NULL,
	`report` text
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`before` text,
	`after` text,
	`note` text,
	`ledger_revision` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`url` text NOT NULL,
	`locator` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`status_detail` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`content_hash` text NOT NULL,
	`snippet_store` text NOT NULL,
	`meta` text,
	`authorship` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_project_url_locator` ON `sources` (`project_id`,`url`,`locator`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`person_name` text NOT NULL,
	`github_handle` text NOT NULL,
	`mode` text NOT NULL,
	`ledger_revision` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
