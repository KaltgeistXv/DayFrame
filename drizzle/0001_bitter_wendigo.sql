CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`color` text DEFAULT '0' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `folder` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `start` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `end` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `position` integer DEFAULT 0 NOT NULL;