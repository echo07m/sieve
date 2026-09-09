CREATE TABLE `orders` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`orderNo` varchar(40) NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`planCode` varchar(32) NOT NULL,
	`planName` varchar(64) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`contractNo` varchar(64) NOT NULL DEFAULT '',
	`payStatus` enum('pending','paid','refunded') NOT NULL DEFAULT 'pending',
	`note` varchar(500) NOT NULL DEFAULT '',
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNo_unique` UNIQUE(`orderNo`)
);
