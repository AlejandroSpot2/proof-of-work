CREATE TABLE `discover_results` (
	`key` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`mode` text NOT NULL,
	`view` text NOT NULL,
	`query` text NOT NULL,
	`source` text NOT NULL,
	`run` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `treg_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`feature` text NOT NULL,
	`endpoint` text NOT NULL,
	`status` text NOT NULL,
	`reserved_micro` integer NOT NULL,
	`cost_micro` integer,
	`call_id` text,
	`served_by` text,
	`http_status` integer,
	`created_at` integer NOT NULL
);
