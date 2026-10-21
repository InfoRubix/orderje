import type { CustomerType, OrderType, Tenant } from "@/db/schema";

type Rates = Pick<Tenant, "sstRate" | "serviceChargeRate" | "memberDiscountRate" | "staffDiscountRate">;

export function discountRate(t: Rates, customerType: CustomerType) {
  if (customerType === "member") return t.memberDiscountRate;
  if (customerType === "staff") return t.staffDiscountRate;
  return 0;
}

/**
 * Subtotal -> discount (by customer type) -> service charge (dine-in only) -> SST.
 * Cash rounding is applied separately at payment time.
 */
export function computeTotals(t: Rates, subtotal: number, customerType: CustomerType, orderType: OrderType) {
  const discount = Math.round((subtotal * discountRate(t, customerType)) / 10000);
  const net = subtotal - discount;
  const serviceCharge = orderType === "dine_in" ? Math.round((net * t.serviceChargeRate) / 10000) : 0;
  const sst = Math.round(((net + serviceCharge) * t.sstRate) / 10000);
  return { subtotal, discount, serviceCharge, sst, total: net + serviceCharge + sst };
}

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: "Dine-in",
  takeaway: "Takeaway",
  delivery: "Delivery",
};

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  walk_in: "Walk-in",
  member: "Member",
  staff: "Staff",
  corporate: "Corporate",
};

export const METHOD_LABEL = {
  cash: "Cash",
  duitnow_qr: "DuitNow QR",
  credit: "Corporate credit",
} as const;
