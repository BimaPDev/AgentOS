CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`description` text,
	`connector_type` text DEFAULT 'mock' NOT NULL,
	`position_x` real DEFAULT 0 NOT NULL,
	`position_y` real DEFAULT 0 NOT NULL,
	`color` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `edges` (
	`id` text PRIMARY KEY NOT NULL,
	`graph_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`source_handle` text,
	`target_handle` text,
	`label` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`source_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `edges_graph_id_idx` ON `edges` (`graph_id`);--> statement-breakpoint
CREATE INDEX `edges_source_node_id_idx` ON `edges` (`source_node_id`);--> statement-breakpoint
CREATE INDEX `edges_target_node_id_idx` ON `edges` (`target_node_id`);--> statement-breakpoint
CREATE TABLE `nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`graph_id` text NOT NULL,
	`type` text NOT NULL,
	`ref_agent_id` text,
	`label` text,
	`position_x` real NOT NULL,
	`position_y` real NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`ref_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nodes_graph_id_idx` ON `nodes` (`graph_id`);--> statement-breakpoint
CREATE TABLE `run_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`node_id` text,
	`ts` text DEFAULT (current_timestamp) NOT NULL,
	`level` text DEFAULT 'info' NOT NULL,
	`message` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `run_logs_run_id_idx` ON `run_logs` (`run_id`);--> statement-breakpoint
CREATE TABLE `run_node_states` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`node_id` text NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`input_text` text,
	`output_text` text,
	`error_text` text,
	`started_at` text,
	`finished_at` text,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`node_id`) REFERENCES `nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `run_node_states_run_id_idx` ON `run_node_states` (`run_id`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`graph_id` text NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`triggered_by` text DEFAULT 'user' NOT NULL
);
