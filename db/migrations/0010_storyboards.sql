CREATE TABLE `storyboards` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`submissionId` bigint unsigned,
	`workTitle` varchar(255) NOT NULL,
	`episodeCount` int NOT NULL DEFAULT 1,
	`shotCount` int NOT NULL DEFAULT 0,
	`totalDurationSec` int NOT NULL DEFAULT 0,
	`shots` json NOT NULL,
	`engineVersion` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `storyboards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `storyboards_userId_idx` ON `storyboards` (`userId`,`createdAt`);
