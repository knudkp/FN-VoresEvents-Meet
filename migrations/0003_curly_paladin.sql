ALTER TABLE `Meetings` ADD `roomName` text;
--> statement-breakpoint
CREATE TABLE `Rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`modified` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted` text,
	`lockedByDefault` integer DEFAULT false NOT NULL,
	`chatEnabledByDefault` integer DEFAULT true NOT NULL,
	`presetHostPasswordHash` text,
	`reservedBy` text NOT NULL
);
