CREATE TABLE `detection_hits` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`submissionId` bigint unsigned NOT NULL,
	`episodeNo` int NOT NULL DEFAULT 1,
	`location` varchar(255) NOT NULL DEFAULT '',
	`spanText` text NOT NULL,
	`category` enum('child_harm','soft_porn','money_worship','marriage_distortion','feudal_dregs','violent_revenge','vulgar_title','ip_infringement') NOT NULL,
	`ruleCode` varchar(32) NOT NULL,
	`ruleName` varchar(255) NOT NULL,
	`severity` enum('block','high','notice') NOT NULL,
	`confidence` decimal(3,2) NOT NULL,
	`basis` text NOT NULL,
	`sourceConfidence` enum('official_text','vendor_interpretation') NOT NULL DEFAULT 'official_text',
	`remediation` text NOT NULL,
	`matchSource` enum('rule_engine','keyword','llm') NOT NULL DEFAULT 'rule_engine',
	`reviewStatus` enum('open','accepted','dismissed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `detection_hits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `filing_packages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`workTitle` varchar(255) NOT NULL,
	`workType` enum('ai_drama','ai_comic','live_drama') NOT NULL DEFAULT 'ai_drama',
	`targetPlatform` varchar(64) NOT NULL DEFAULT 'universal',
	`investment` decimal(12,2) NOT NULL,
	`episodeCount` int NOT NULL,
	`episodeDuration` int NOT NULL DEFAULT 2,
	`synopsis` text,
	`producerName` varchar(255),
	`licenseNo` varchar(255),
	`costBreakdown` json DEFAULT ('[]'),
	`tierResult` json,
	`materials` json,
	`missingFields` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `filing_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`submissionId` bigint unsigned NOT NULL,
	`reportNo` varchar(40) NOT NULL,
	`verdict` enum('high_risk','attention','low_risk') NOT NULL,
	`summary` json NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`ruleVersion` varchar(32) NOT NULL,
	`disclaimer` text NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `reports_submissionId_unique` UNIQUE(`submissionId`),
	CONSTRAINT `reports_reportNo_unique` UNIQUE(`reportNo`)
);
--> statement-breakpoint
CREATE TABLE `rule_versions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`version` varchar(32) NOT NULL,
	`note` text,
	`ruleCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rule_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `rule_versions_version_unique` UNIQUE(`version`)
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`ruleCode` varchar(32) NOT NULL,
	`version` varchar(32) NOT NULL DEFAULT '1.0.0',
	`status` enum('active','disabled') NOT NULL DEFAULT 'active',
	`category` enum('child_harm','soft_porn','money_worship','marriage_distortion','feudal_dregs','violent_revenge','vulgar_title','ip_infringement') NOT NULL,
	`name` varchar(255) NOT NULL,
	`severity` enum('block','high','notice') NOT NULL,
	`sourcePolicy` varchar(255) NOT NULL,
	`sourceClause` varchar(255) NOT NULL,
	`originalText` text NOT NULL,
	`sourceConfidence` enum('official_text','vendor_interpretation') NOT NULL DEFAULT 'official_text',
	`scope` json NOT NULL,
	`keywords` json NOT NULL DEFAULT ('[]'),
	`patterns` json NOT NULL DEFAULT ('[]'),
	`cooccurrence` json DEFAULT ('[]'),
	`baseConfidence` decimal(3,2) NOT NULL DEFAULT '0.80',
	`remediationTemplate` text NOT NULL,
	`platformOverrides` json DEFAULT ('{}'),
	`effectiveAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `rules_ruleCode_unique` UNIQUE(`ruleCode`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`workTitle` varchar(255) NOT NULL,
	`workType` enum('ai_drama','ai_comic','live_drama') NOT NULL DEFAULT 'ai_drama',
	`targetPlatform` varchar(64) NOT NULL DEFAULT 'universal',
	`scriptText` longtext NOT NULL,
	`episodeCount` int NOT NULL DEFAULT 1,
	`charCount` int NOT NULL DEFAULT 0,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`verdict` enum('high_risk','attention','low_risk'),
	`ruleVersion` varchar(32),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`avatar` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`)
);
