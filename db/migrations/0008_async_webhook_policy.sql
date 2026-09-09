CREATE TABLE `detect_tasks` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`taskNo` varchar(40) NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`apiKeyId` bigint unsigned NOT NULL,
	`workTitle` varchar(255) NOT NULL,
	`status` enum('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
	`input` json NOT NULL,
	`result` json,
	`error` varchar(500) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `detect_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `detect_tasks_taskNo_unique` UNIQUE(`taskNo`)
);
--> statement-breakpoint
CREATE TABLE `policy_updates` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`source` varchar(128) NOT NULL DEFAULT '',
	`sourceUrl` varchar(300) NOT NULL DEFAULT '',
	`publishedAt` timestamp,
	`summary` varchar(1000) NOT NULL,
	`impactAssessment` varchar(1000) NOT NULL DEFAULT '',
	`relatedRuleCodes` json NOT NULL,
	`status` enum('pending','reviewed','converted') NOT NULL DEFAULT 'pending',
	`draftRuleCode` varchar(32) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `policy_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`endpointId` bigint unsigned NOT NULL,
	`taskId` bigint unsigned,
	`event` varchar(32) NOT NULL,
	`payload` json NOT NULL,
	`status` enum('pending','success','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`responseCode` int,
	`lastError` varchar(500) NOT NULL DEFAULT '',
	`nextRetryAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`deliveredAt` timestamp,
	CONSTRAINT `webhook_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_endpoints` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`name` varchar(64) NOT NULL DEFAULT '',
	`url` varchar(300) NOT NULL,
	`secret` varchar(80) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_endpoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `detect_tasks_userId_idx` ON `detect_tasks` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `policy_updates_status_idx` ON `policy_updates` (`status`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_status_idx` ON `webhook_deliveries` (`status`,`nextRetryAt`);--> statement-breakpoint
CREATE INDEX `webhook_endpoints_userId_idx` ON `webhook_endpoints` (`userId`);