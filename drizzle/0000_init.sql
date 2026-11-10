CREATE TABLE `shops` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`apns_topic_bundle_id` text NOT NULL,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shops_slug_uq` ON `shops` (`slug`);
--> statement-breakpoint
CREATE TABLE `shop_daily_counters` (
	`shop_id` text NOT NULL,
	`business_date` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shop_daily_counters_uq` ON `shop_daily_counters` (`shop_id`,`business_date`);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`order_number` text NOT NULL,
	`business_date` text NOT NULL,
	`items` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`eta_minutes` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ready_at` integer,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_shop_date_number_uq` ON `orders` (`shop_id`,`business_date`,`order_number`);
--> statement-breakpoint
CREATE INDEX `orders_shop_status_idx` ON `orders` (`shop_id`,`status`);
--> statement-breakpoint
CREATE TABLE `push_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`platform` text NOT NULL,
	`token` text NOT NULL,
	`environment` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_success_at` integer,
	`invalidated_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_registrations_order_platform_uq` ON `push_registrations` (`order_id`,`platform`);
--> statement-breakpoint
CREATE INDEX `push_registrations_order_idx` ON `push_registrations` (`order_id`);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`order_id`);
--> statement-breakpoint
CREATE TABLE `staff_users` (
	`id` text PRIMARY KEY NOT NULL,
	`shop_id` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_users_shop_email_uq` ON `staff_users` (`shop_id`,`email`);
--> statement-breakpoint
CREATE TABLE `staff_refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `staff_refresh_tokens_user_idx` ON `staff_refresh_tokens` (`user_id`);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`response_body` text,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_keys_key_uq` ON `idempotency_keys` (`key`);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`idempotency_key` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`run_after` integer NOT NULL,
	`locked_at` integer,
	`created_at` integer NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `jobs_poll_idx` ON `jobs` (`status`,`run_after`);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idempotency_uq` ON `jobs` (`idempotency_key`);
--> statement-breakpoint
CREATE TABLE `notification_dead_letters` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text,
	`job_id` text,
	`channel` text NOT NULL,
	`error_code` text,
	`error_message` text,
	`payload_snippet` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
