ALTER TABLE `projects` ADD `scheduleMode` text DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `tracking` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `baselineStart` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `baselineEnd` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `startedOn` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `completedOn` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `rolledDays` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE projects SET scheduleMode='manual' WHERE start!='';
