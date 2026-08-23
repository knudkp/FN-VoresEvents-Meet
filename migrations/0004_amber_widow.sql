CREATE TABLE `Users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`modified` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted` text,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`displayName` text,
	`role` text DEFAULT 'user' NOT NULL,
	`passwordHash` text,
	`passwordSalt` text,
	`inviteTokenHash` text,
	`inviteTokenExpires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Users_username_unique` ON `Users` (`username`);
