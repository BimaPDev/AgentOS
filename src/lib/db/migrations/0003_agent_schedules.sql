CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`interval_minutes` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`next_run_at` text NOT NULL,
	`last_run_at` text,
	`last_run_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `schedules_agent_id_idx` ON `schedules` (`agent_id`);
--> statement-breakpoint
CREATE INDEX `schedules_next_run_at_idx` ON `schedules` (`next_run_at`);
