CREATE TABLE `categories` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`type` varchar(16) NOT NULL,
	`name` varchar(120) NOT NULL,
	`phone` varchar(32),
	`company` varchar(160),
	`credit_limit` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dining_tables` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`label` varchar(40) NOT NULL,
	`token` varchar(32) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `dining_tables_id` PRIMARY KEY(`id`),
	CONSTRAINT `dining_tables_token_uq` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`category_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` varchar(255),
	`price` int NOT NULL,
	`image_url` text,
	`available` boolean NOT NULL DEFAULT true,
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `menu_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modifier_groups` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`menu_item_id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`required` boolean NOT NULL DEFAULT false,
	`max_select` int NOT NULL DEFAULT 1,
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `modifier_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modifier_options` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`group_id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`price` int NOT NULL DEFAULT 0,
	`sort` int NOT NULL DEFAULT 0,
	CONSTRAINT `modifier_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`menu_item_id` varchar(36),
	`name` varchar(120) NOT NULL,
	`modifiers` varchar(255),
	`note` varchar(160),
	`unit_price` int NOT NULL,
	`qty` int NOT NULL,
	`line_total` int NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`order_no` int NOT NULL,
	`public_token` varchar(32) NOT NULL,
	`source` varchar(8) NOT NULL,
	`order_type` varchar(16) NOT NULL,
	`table_id` varchar(36),
	`table_label` varchar(40),
	`customer_type` varchar(16) NOT NULL DEFAULT 'walk_in',
	`customer_id` varchar(36),
	`customer_name` varchar(120),
	`customer_phone` varchar(32),
	`status` varchar(16) NOT NULL DEFAULT 'new',
	`payment_status` varchar(16) NOT NULL DEFAULT 'unpaid',
	`subtotal` int NOT NULL DEFAULT 0,
	`discount` int NOT NULL DEFAULT 0,
	`service_charge` int NOT NULL DEFAULT 0,
	`sst` int NOT NULL DEFAULT 0,
	`rounding` int NOT NULL DEFAULT 0,
	`total` int NOT NULL DEFAULT 0,
	`note` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`paid_at` datetime,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_public_token_uq` UNIQUE(`public_token`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`order_id` varchar(36),
	`customer_id` varchar(36),
	`kind` varchar(16) NOT NULL DEFAULT 'order',
	`method` varchar(16) NOT NULL,
	`status` varchar(16) NOT NULL,
	`amount` int NOT NULL,
	`tendered` int,
	`change_given` int,
	`reference` varchar(120),
	`gateway_bill_code` varchar(64),
	`received_by` varchar(36),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`confirmed_at` datetime,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reconciliations` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`business_date` varchar(10) NOT NULL,
	`opening_float` int NOT NULL DEFAULT 0,
	`expected_cash` int NOT NULL,
	`counted_cash` int NOT NULL,
	`expected_qr` int NOT NULL,
	`bank_qr` int NOT NULL,
	`expected_online` int NOT NULL,
	`gateway_online` int NOT NULL,
	`credit_sales` int NOT NULL,
	`notes` varchar(500),
	`closed_by` varchar(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `reconciliations_id` PRIMARY KEY(`id`),
	CONSTRAINT `recon_tenant_date_uq` UNIQUE(`tenant_id`,`business_date`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` varchar(36) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`address` varchar(255),
	`phone` varchar(32),
	`email` varchar(160),
	`sst_rate` int NOT NULL DEFAULT 0,
	`service_charge_rate` int NOT NULL DEFAULT 0,
	`member_discount_rate` int NOT NULL DEFAULT 500,
	`staff_discount_rate` int NOT NULL DEFAULT 2000,
	`duitnow_qr_url` text,
	`toyyibpay_secret` varchar(128),
	`toyyibpay_category` varchar(64),
	`toyyibpay_sandbox` boolean NOT NULL DEFAULT true,
	`allow_qr_counter_pay` boolean NOT NULL DEFAULT true,
	`receipt_footer` varchar(255),
	`order_seq` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(160) NOT NULL,
	`password_hash` varchar(100) NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'cashier',
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `categories_tenant_idx` ON `categories` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `customers_tenant_idx` ON `customers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `dining_tables_tenant_idx` ON `dining_tables` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `menu_items_tenant_idx` ON `menu_items` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `modifier_groups_item_idx` ON `modifier_groups` (`menu_item_id`);--> statement-breakpoint
CREATE INDEX `modifier_options_group_idx` ON `modifier_options` (`group_id`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_tenant_created_idx` ON `orders` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_tenant_status_idx` ON `orders` (`tenant_id`,`status`);--> statement-breakpoint
CREATE INDEX `payments_tenant_created_idx` ON `payments` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `payments_order_idx` ON `payments` (`order_id`);--> statement-breakpoint
CREATE INDEX `payments_bill_idx` ON `payments` (`gateway_bill_code`);--> statement-breakpoint
CREATE INDEX `users_tenant_idx` ON `users` (`tenant_id`);