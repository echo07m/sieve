CREATE INDEX `api_keys_userId_idx` ON `api_keys` (`userId`);--> statement-breakpoint
CREATE INDEX `copyright_checks_userId_idx` ON `copyright_checks` (`userId`);--> statement-breakpoint
CREATE INDEX `custom_rules_userId_idx` ON `custom_rules` (`userId`);--> statement-breakpoint
CREATE INDEX `deliveries_userId_idx` ON `deliveries` (`userId`);--> statement-breakpoint
CREATE INDEX `detection_hits_submissionId_idx` ON `detection_hits` (`submissionId`);--> statement-breakpoint
CREATE INDEX `filing_packages_userId_idx` ON `filing_packages` (`userId`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `submissions_userId_idx` ON `submissions` (`userId`);--> statement-breakpoint
CREATE INDEX `subscriptions_userId_idx` ON `subscriptions` (`userId`);