CREATE TABLE `organizations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`ownerId` bigint unsigned NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_members` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`orgId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`role` enum('owner','reviewer','editor') NOT NULL DEFAULT 'editor',
	`licenseNo` varchar(64) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `org_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_members_org_user_unique` UNIQUE(`orgId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `review_assignments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`orgId` bigint unsigned NOT NULL,
	`submissionId` bigint unsigned NOT NULL,
	`assigneeId` bigint unsigned NOT NULL,
	`assignedBy` bigint unsigned NOT NULL,
	`status` enum('pending','in_review','approved','rejected') NOT NULL DEFAULT 'pending',
	`note` varchar(500) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `review_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_annotations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`assignmentId` bigint unsigned NOT NULL,
	`hitId` bigint unsigned,
	`authorId` bigint unsigned NOT NULL,
	`content` varchar(1000) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_annotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`orgId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`action` varchar(64) NOT NULL,
	`targetType` varchar(32) NOT NULL DEFAULT '',
	`targetId` bigint unsigned,
	`detail` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `organizations_ownerId_idx` ON `organizations` (`ownerId`);
--> statement-breakpoint
CREATE INDEX `org_members_orgId_idx` ON `org_members` (`orgId`);
--> statement-breakpoint
CREATE INDEX `org_members_userId_idx` ON `org_members` (`userId`);
--> statement-breakpoint
CREATE INDEX `review_assignments_orgId_idx` ON `review_assignments` (`orgId`);
--> statement-breakpoint
CREATE INDEX `review_assignments_assigneeId_idx` ON `review_assignments` (`assigneeId`,`status`);
--> statement-breakpoint
CREATE INDEX `review_annotations_assignmentId_idx` ON `review_annotations` (`assignmentId`);
--> statement-breakpoint
CREATE INDEX `audit_logs_orgId_idx` ON `audit_logs` (`orgId`,`createdAt`);
