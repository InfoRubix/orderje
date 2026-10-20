/**
 * Firestore data model. Money is stored as integer sen (RM 1.00 = 100). Rates are basis points (6% = 600).
 *
 *   tenants/{tenantId}                         Tenant (+ orderSeq counter)
 *     categories/{id}                          Category
 *     menuItems/{id}                           MenuItem, add-on groups embedded
 *     tables/{id}                              DiningTable
 *     customers/{id}                           Customer
 *     orders/{id}                              Order, line items embedded
 *     payments/{id}                            Payment
 *     reconciliations/{YYYY-MM-DD}             Reconciliation (doc id = business date, so one per day)
 *   users/{id}                                 User (tenantId field)
 *
 * Lookup docs that also enforce uniqueness:
 *   slugs/{slug}          -> { tenantId }
 *   emails/{email}        -> { userId }
 *   orderTokens/{token}   -> { tenantId, orderId }
 *   bills/{billCode}      -> { tenantId, paymentId }
 *
 * Every query is a single-field filter, so no composite indexes are needed.
 */

export type Role = "owner" | "cashier" | "kitchen";
export type OrderType = "dine_in" | "takeaway" | "delivery";
export type CustomerType = "walk_in" | "member" | "staff" | "corporate";
export type RegisteredCustomerType = Exclude<CustomerType, "walk_in">;
export type OrderStatus = "new" | "preparing" | "ready" | "served" | "cancelled";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "credit";
export type PaymentMethod = "cash" | "duitnow_qr" | "online" | "credit";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  sstRate: number;
  serviceChargeRate: number;
  memberDiscountRate: number;
  staffDiscountRate: number;
  duitnowQrUrl: string | null;
  toyyibpaySecret: string | null;
  toyyibpayCategory: string | null;
  toyyibpaySandbox: boolean;
  allowQrCounterPay: boolean;
  receiptFooter: string | null;
  orderSeq: number;
  active: boolean;
  createdAt: Date;
};

export type User = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: Date;
};

export type Category = { id: string; tenantId: string; name: string; sort: number };

export type ModifierOption = { id: string; groupId: string; name: string; price: number; sort: number };

/** Add-on groups per item, e.g. "Telur" (required, pick 1) or "Extra" (optional, pick many). */
export type ModifierGroup = {
  id: string;
  menuItemId: string;
  name: string;
  required: boolean;
  maxSelect: number;
  sort: number;
  options: ModifierOption[];
};

export type MenuItem = {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
  sort: number;
  groups: ModifierGroup[];
};

export type DiningTable = {
  id: string;
  tenantId: string;
  label: string;
  token: string;
  active: boolean;
  sort: number;
};

/** Registered customers. Walk-ins are not stored here. */
export type Customer = {
  id: string;
  tenantId: string;
  type: RegisteredCustomerType;
  name: string;
  phone: string | null;
  company: string | null;
  creditLimit: number;
  active: boolean;
  createdAt: Date;
};

export type OrderItem = {
  id: string;
  menuItemId: string | null;
  name: string;
  modifiers: string | null;
  note: string | null;
  unitPrice: number;
  qty: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  tenantId: string;
  orderNo: number;
  publicToken: string;
  source: "qr" | "counter";
  orderType: OrderType;
  tableId: string | null;
  tableLabel: string | null;
  customerType: CustomerType;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discount: number;
  serviceCharge: number;
  sst: number;
  rounding: number;
  total: number;
  note: string | null;
  items: OrderItem[];
  createdAt: Date;
  paidAt: Date | null;
};

export type Payment = {
  id: string;
  tenantId: string;
  orderId: string | null;
  customerId: string | null;
  kind: "order" | "settlement";
  method: PaymentMethod;
  status: "pending" | "success" | "failed";
  amount: number;
  tendered: number | null;
  changeGiven: number | null;
  reference: string | null;
  gatewayBillCode: string | null;
  receivedBy: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
};

/** End-of-day reconciliation, one per business date. */
export type Reconciliation = {
  id: string;
  tenantId: string;
  businessDate: string;
  openingFloat: number;
  expectedCash: number;
  countedCash: number;
  expectedQr: number;
  bankQr: number;
  expectedOnline: number;
  gatewayOnline: number;
  creditSales: number;
  notes: string | null;
  closedBy: string;
  createdAt: Date;
};
