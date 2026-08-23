ALTER TABLE `Meetings` ADD `hostPasswordHash` text;
--> statement-breakpoint
CREATE TABLE `ChatMessages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`modified` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted` text,
	`meetingId` text REFERENCES Meetings(id),
	`fromId` text NOT NULL,
	`fromName` text NOT NULL,
	`message` text NOT NULL,
	`sentAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `AdminAuditLog` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`modified` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted` text,
	`meetingId` text REFERENCES Meetings(id),
	`action` text NOT NULL,
	`actorId` text NOT NULL,
	`actorName` text NOT NULL,
	`targetId` text,
	`targetName` text
);
