ALTER TABLE `users` ADD COLUMN `username` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(255) NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `githubId` varchar(32) NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_githubId_unique` ON `users` (`githubId`);
--> statement-breakpoint
CREATE TABLE `auth_providers` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`provider` varchar(32) NOT NULL,
	`clientId` varchar(128) NOT NULL DEFAULT '',
	`clientSecret` varchar(128) NOT NULL DEFAULT '',
	`enabled` boolean NOT NULL DEFAULT false,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_providers_provider_unique` UNIQUE(`provider`)
);
