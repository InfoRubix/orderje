import {
  mysqlTable,
  varchar,
  int,
  boolean,
  text,
  datetime,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import { relations, sql } from "drizzle-orm";

/**
 * Money is stored as integer sen (RM 1.00 = 100). Rates are basis points (6% = 600).
 * Every business table carries tenantId: one database, many kedai.
 */

const id = () => varchar("id", { length: 36 }).primaryKey();
const tenantRef = () => varchar("tenant_id", { length: 36 }).notNull();
const createdAt = () =>
  datetime("created_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$defaultFn(() => new Date());

export const tenants = mysqlTable(
  "tenants",
  {
    id: id(),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    address: varchar("address", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 160 }),
    sstRate: int("sst_rate").notNull().default(0),
    serviceChargeRate: int("service_charge_rate").notNull().default(0),
    memberDiscountRate: int("member_discount_rate").notNull().default(500),
    staffDiscountRate: int("staff_discount_rate").notNull().default(2000),
    duitnowQrUrl: text("duitnow_qr_url"),
    toyyibpaySecret: varchar("toyyibpay_secret", { length: 128 }),
    toyyibpayCategory: varchar("toyyibpay_category", { length: 64 }),
    toyyibpaySandbox: boolean("toyyibpay_sandbox").notNull().default(true),
    allowQrCounterPay: boolean("allow_qr_counter_pay").notNull().default(true),
    receiptFooter: varchar("receipt_footer", { length: 255 }),
    orderSeq: int("order_seq").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tenants_slug_uq").on(t.slug)],
);

export const users = mysqlTable(
  "users",
  {
    id: id(),
    tenantId: tenantRef(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    passwordHash: varchar("password_hash", { length: 100 }).notNull(),
    role: varchar("role", { length: 16 }).$type<Role>().notNull().default("cashier"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), index("users_tenant_idx").on(t.tenantId)],
);

export const categories = mysqlTable(
  "categories",
  {
    id: id(),
    tenantId: tenantRef(),
    name: varchar("name", { length: 80 }).notNull(),
    sort: int("sort").notNull().default(0),
  },
  (t) => [index("categories_tenant_idx").on(t.tenantId)],
);

export const menuItems = mysqlTable(
  "menu_items",
  {
    id: id(),
    tenantId: tenantRef(),
    categoryId: varchar("category_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 255 }),
    price: int("price").notNull(),
    imageUrl: text("image_url"),
    available: boolean("available").notNull().default(true),
    sort: int("sort").notNull().default(0),
  },
  (t) => [index("menu_items_tenant_idx").on(t.tenantId)],
);

/** Add-on groups per item, e.g. "Telur" (required, pick 1) or "Extra" (optional, pick many). */
export const modifierGroups = mysqlTable(
  "modifier_groups",
  {
    id: id(),
    tenantId: tenantRef(),
    menuItemId: varchar("menu_item_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    required: boolean("required").notNull().default(false),
    maxSelect: int("max_select").notNull().default(1),
    sort: int("sort").notNull().default(0),
  },
  (t) => [index("modifier_groups_item_idx").on(t.menuItemId)],
);

export const modifierOptions = mysqlTable(
  "modifier_options",
  {
    id: id(),
    tenantId: tenantRef(),
    groupId: varchar("group_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    price: int("price").notNull().default(0),
    sort: int("sort").notNull().default(0),
  },
  (t) => [index("modifier_options_group_idx").on(t.groupId)],
);

export const diningTables = mysqlTable(
  "dining_tables",
  {
    id: id(),
    tenantId: tenantRef(),
    label: varchar("label", { length: 40 }).notNull(),
    token: varchar("token", { length: 32 }).notNull(),
    active: boolean("active").notNull().default(true),
    sort: int("sort").notNull().default(0),
  },
  (t) => [uniqueIndex("dining_tables_token_uq").on(t.token), index("dining_tables_tenant_idx").on(t.tenantId)],
);

/** Registered customers. Walk-ins are not stored here. */
export const customers = mysqlTable(
  "customers",
  {
    id: id(),
    tenantId: tenantRef(),
    type: varchar("type", { length: 16 }).$type<RegisteredCustomerType>().notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    company: varchar("company", { length: 160 }),
    creditLimit: int("credit_limit").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("customers_tenant_idx").on(t.tenantId)],
);

export const orders = mysqlTable(
  "orders",
  {
    id: id(),
    tenantId: tenantRef(),
    orderNo: int("order_no").notNull(),
    publicToken: varchar("public_token", { length: 32 }).notNull(),
    source: varchar("source", { length: 8 }).$type<"qr" | "counter">().notNull(),
    orderType: varchar("order_type", { length: 16 }).$type<OrderType>().notNull(),
    tableId: varchar("table_id", { length: 36 }),
    tableLabel: varchar("table_label", { length: 40 }),
    customerType: varchar("customer_type", { length: 16 }).$type<CustomerType>().notNull().default("walk_in"),
    customerId: varchar("customer_id", { length: 36 }),
    customerName: varchar("customer_name", { length: 120 }),
    customerPhone: varchar("customer_phone", { length: 32 }),
    status: varchar("status", { length: 16 }).$type<OrderStatus>().notNull().default("new"),
    paymentStatus: varchar("payment_status", { length: 16 }).$type<PaymentStatus>().notNull().default("unpaid"),
    subtotal: int("subtotal").notNull().default(0),
    discount: int("discount").notNull().default(0),
    serviceCharge: int("service_charge").notNull().default(0),
    sst: int("sst").notNull().default(0),
    rounding: int("rounding").notNull().default(0),
    total: int("total").notNull().default(0),
    note: varchar("note", { length: 255 }),
    createdAt: createdAt(),
    paidAt: datetime("paid_at", { mode: "date" }),
  },
  (t) => [
    uniqueIndex("orders_public_token_uq").on(t.publicToken),
    index("orders_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("orders_tenant_status_idx").on(t.tenantId, t.status),
  ],
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: id(),
    tenantId: tenantRef(),
    orderId: varchar("order_id", { length: 36 }).notNull(),
    menuItemId: varchar("menu_item_id", { length: 36 }),
    name: varchar("name", { length: 120 }).notNull(),
    modifiers: varchar("modifiers", { length: 255 }),
    note: varchar("note", { length: 160 }),
    unitPrice: int("unit_price").notNull(),
    qty: int("qty").notNull(),
    lineTotal: int("line_total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const payments = mysqlTable(
  "payments",
  {
    id: id(),
    tenantId: tenantRef(),
    orderId: varchar("order_id", { length: 36 }),
    customerId: varchar("customer_id", { length: 36 }),
    kind: varchar("kind", { length: 16 }).$type<"order" | "settlement">().notNull().default("order"),
    method: varchar("method", { length: 16 }).$type<PaymentMethod>().notNull(),
    status: varchar("status", { length: 16 }).$type<"pending" | "success" | "failed">().notNull(),
    amount: int("amount").notNull(),
    tendered: int("tendered"),
    changeGiven: int("change_given"),
    reference: varchar("reference", { length: 120 }),
    gatewayBillCode: varchar("gateway_bill_code", { length: 64 }),
    receivedBy: varchar("received_by", { length: 36 }),
    createdAt: createdAt(),
    confirmedAt: datetime("confirmed_at", { mode: "date" }),
  },
  (t) => [
    index("payments_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("payments_order_idx").on(t.orderId),
    index("payments_bill_idx").on(t.gatewayBillCode),
  ],
);

/** End-of-day reconciliation, one per business date. */
export const reconciliations = mysqlTable(
  "reconciliations",
  {
    id: id(),
    tenantId: tenantRef(),
    businessDate: varchar("business_date", { length: 10 }).notNull(),
    openingFloat: int("opening_float").notNull().default(0),
    expectedCash: int("expected_cash").notNull(),
    countedCash: int("counted_cash").notNull(),
    expectedQr: int("expected_qr").notNull(),
    bankQr: int("bank_qr").notNull(),
    expectedOnline: int("expected_online").notNull(),
    gatewayOnline: int("gateway_online").notNull(),
    creditSales: int("credit_sales").notNull(),
    notes: varchar("notes", { length: 500 }),
    closedBy: varchar("closed_by", { length: 36 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("recon_tenant_date_uq").on(t.tenantId, t.businessDate)],
);

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  payments: many(payments),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));
export const menuItemsRelations = relations(menuItems, ({ many }) => ({
  groups: many(modifierGroups),
}));
export const modifierGroupsRelations = relations(modifierGroups, ({ one, many }) => ({
  item: one(menuItems, { fields: [modifierGroups.menuItemId], references: [menuItems.id] }),
  options: many(modifierOptions),
}));
export const modifierOptionsRelations = relations(modifierOptions, ({ one }) => ({
  group: one(modifierGroups, { fields: [modifierOptions.groupId], references: [modifierGroups.id] }),
}));

export type Role = "owner" | "cashier" | "kitchen";
export type OrderType = "dine_in" | "takeaway" | "delivery";
export type CustomerType = "walk_in" | "member" | "staff" | "corporate";
export type RegisteredCustomerType = Exclude<CustomerType, "walk_in">;
export type OrderStatus = "new" | "preparing" | "ready" | "served" | "cancelled";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "credit";
export type PaymentMethod = "cash" | "duitnow_qr" | "online" | "credit";

export type Tenant = typeof tenants.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
