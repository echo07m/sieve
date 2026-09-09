CREATE TABLE `leads` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`company` varchar(128) NOT NULL DEFAULT '',
	`contact` varchar(128) NOT NULL,
	`message` text,
	`source` varchar(32) NOT NULL DEFAULT 'pricing',
	`planInterest` varchar(32) NOT NULL DEFAULT '',
	`status` enum('new','contacted','converted') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`planCode` varchar(32) NOT NULL DEFAULT 'free',
	`planName` varchar(64) NOT NULL DEFAULT '免费试检',
	`status` enum('active','expired') NOT NULL DEFAULT 'active',
	`quotaTotal` int NOT NULL DEFAULT 3,
	`quotaUsed` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`note` varchar(255) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
