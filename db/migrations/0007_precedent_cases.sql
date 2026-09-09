CREATE TABLE `precedent_cases` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`title` varchar(128) NOT NULL,
	`platform` varchar(32) NOT NULL DEFAULT '',
	`caseType` enum('platform_action','judicial','regulatory','rights_protection') NOT NULL,
	`summary` varchar(1000) NOT NULL,
	`violation` varchar(200) NOT NULL DEFAULT '',
	`outcome` varchar(300) NOT NULL DEFAULT '',
	`source` varchar(128) NOT NULL DEFAULT '',
	`sourceUrl` varchar(300) NOT NULL DEFAULT '',
	`relatedRuleCodes` json NOT NULL,
	`occurredAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `precedent_cases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `precedent_cases_type_idx` ON `precedent_cases` (`caseType`,`isActive`);