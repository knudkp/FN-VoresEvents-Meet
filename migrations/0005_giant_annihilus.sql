CREATE TABLE `BannedIps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`modified` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted` text,
	`ip` text NOT NULL,
	`reason` text,
	`bannedBy` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `BannedUsernames` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`modified` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted` text,
	`username` text NOT NULL,
	`reason` text,
	`bannedBy` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `BannedIps_ip_unique` ON `BannedIps` (`ip`);--> statement-breakpoint
CREATE UNIQUE INDEX `BannedUsernames_username_unique` ON `BannedUsernames` (`username`);