CREATE TABLE `api_keys` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`name` varchar(128) NOT NULL,
	`prefix` varchar(16) NOT NULL,
	`keyHash` varchar(64) NOT NULL,
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_keys_keyHash_unique` UNIQUE(`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `auth_chains` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`workTitle` varchar(255) NOT NULL,
	`ipName` varchar(255) NOT NULL,
	`node` enum('authorization_application','adaptation_boundary','key_plot_confirm','mid_review','final_review','filing_record') NOT NULL,
	`status` enum('pending','done') NOT NULL DEFAULT 'pending',
	`evidenceText` text NOT NULL DEFAULT (''),
	`evidenceHash` varchar(64) NOT NULL DEFAULT '',
	`operatorName` varchar(128) NOT NULL DEFAULT '',
	`occurredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_chains_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `copyright_checks` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`workTitle` varchar(255) NOT NULL,
	`refTitle` varchar(255) NOT NULL,
	`refText` text NOT NULL,
	`targetText` text NOT NULL,
	`result` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `copyright_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_rules` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`ruleCode` varchar(40) NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` enum('child_harm','soft_porn','money_worship','marriage_distortion','feudal_dregs','violent_revenge','vulgar_title','ip_infringement') NOT NULL,
	`severity` enum('block','high','notice') NOT NULL DEFAULT 'notice',
	`keywords` json NOT NULL DEFAULT ('[]'),
	`patterns` json NOT NULL DEFAULT ('[]'),
	`remediationTemplate` text NOT NULL DEFAULT (''),
	`status` enum('active','disabled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`filingId` bigint unsigned NOT NULL,
	`channel` varchar(64) NOT NULL,
	`status` enum('preparing','submitted','under_review','accepted','rejected') NOT NULL DEFAULT 'preparing',
	`receiptNo` varchar(128) NOT NULL DEFAULT '',
	`rejectReason` text,
	`deadlineDays` int NOT NULL DEFAULT 15,
	`submittedAt` timestamp,
	`resolvedAt` timestamp,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ip_references` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`aliases` json DEFAULT ('[]'),
	`origin` varchar(128) NOT NULL DEFAULT '',
	`category` varchar(32) NOT NULL DEFAULT '名著',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ip_references_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_configs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`strictness` int NOT NULL DEFAULT 3,
	`filingChannel` varchar(255) NOT NULL DEFAULT '',
	`aiMarkingSpec` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `platform_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_configs_code_unique` UNIQUE(`code`)
);
