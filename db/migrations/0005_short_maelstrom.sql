CREATE TABLE `notifications` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`type` enum('detection_done','detection_failed','quota_low','plan_activated','plan_expiring','system') NOT NULL,
	`title` varchar(128) NOT NULL,
	`content` varchar(1000) NOT NULL DEFAULT '',
	`refId` bigint unsigned,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `rule_versions` ADD `snapshot` json;--> statement-breakpoint
CREATE INDEX `notifications_userId_isRead_idx` ON `notifications` (`userId`,`isRead`);