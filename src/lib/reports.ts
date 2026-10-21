import "server-only";
import type { CustomerType, OrderType, PaymentMethod } from "@/db/schema";
import {
  getReconciliation,
  ordersCreatedBetween,
  ordersPaidBetween,
  paymentsConfirmedBetween,
} from "./repo";
import { getOrderRow } from "./orders";
import { dayRange, myDate } from "./time";

/**
 * Firestore has no GROUP BY, so reports read the day's (or range's) documents and add them up here.
 * A busy kedai does a few hundred orders a day, so even a 30-day dashboard is a few thousand small reads.
 */

const METHODS: PaymentMethod[] = ["cash", "duitnow_qr", "credit"];
const zeroMethods = () => ({ cash: 0, duitnow_qr: 0, credit: 0 }) as Record<PaymentMethod, number>;

/**
 * Money received on one business date, counted by when the payment was confirmed
 * (a dinner order paid after midnight lands on the next day, like the cash drawer).
 */
export async function reconSummary(tenantId: string, date: string) {
  const { start, end } = dayRange(date);
  const [pays, created, closed] = await Promise.all([
    paymentsConfirmedBetween(tenantId, start, end),
    ordersCreatedBetween(tenantId, start, end),
    getReconciliation(tenantId, date),
  ]);

  const byMethod = zeroMethods();
  const countByMethod = zeroMethods();
  const settlements = zeroMethods();
  for (const p of pays) {
    if (p.kind === "order") {
      byMethod[p.method] += p.amount;
      countByMethod[p.method] += 1;
    } else settlements[p.method] += p.amount;
  }

  const open = created.filter((o) => o.status !== "cancelled" && o.paymentStatus === "unpaid");

  const electronicPays = pays.filter((p) => p.method === "duitnow_qr");
  const orderNos = new Map<string, number>();
  await Promise.all(
    [...new Set(electronicPays.map((p) => p.orderId).filter((id): id is string => Boolean(id)))].map(async (id) => {
      const o = await getOrderRow(tenantId, id);
      if (o) orderNos.set(id, o.orderNo);
    }),
  );

  return {
    date,
    byMethod,
    countByMethod,
    settlements,
    collected: METHODS.filter((m) => m !== "credit").reduce((s, m) => s + byMethod[m] + settlements[m], 0),
    openOrders: open.length,
    openOrderNos: open.map((o) => o.orderNo).sort((a, b) => a - b),
    electronic: electronicPays.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      method: p.method,
      kind: p.kind,
      amount: p.amount,
      reference: p.reference,
      confirmedAt: p.confirmedAt,
      orderNo: p.orderId ? (orderNos.get(p.orderId) ?? null) : null,
    })),
    closed: closed ?? null,
  };
}

type Bucket = { total: number; n: number };
function add<K extends string>(m: Partial<Record<K, Bucket>>, k: K, total: number) {
  const b = (m[k] ??= { total: 0, n: 0 });
  b.total += total;
  b.n += 1;
}

/** Hour of day in Malaysia time. */
const myHour = (d: Date) => (d.getUTCHours() + 8) % 24;

/** Sales for a date range [from, to] inclusive, counted on orders settled in the range. */
export async function salesReport(tenantId: string, from: string, to: string) {
  const start = dayRange(from).start;
  const end = dayRange(to).end;
  const [settled, created, pays] = await Promise.all([
    ordersPaidBetween(tenantId, start, end),
    ordersCreatedBetween(tenantId, start, end),
    paymentsConfirmedBetween(tenantId, start, end),
  ]);

  const r = { sales: 0, subtotal: 0, discount: 0, sst: 0, service: 0 };
  const byType: Partial<Record<OrderType, Bucket>> = {};
  const byCustomer: Partial<Record<CustomerType, Bucket>> = {};
  const bySource: Partial<Record<"qr" | "counter", Bucket>> = {};
  const byMethod: Partial<Record<PaymentMethod, Bucket>> = {};
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, total: 0, n: 0 }));
  const days = new Map<string, Bucket>();
  const items = new Map<string, { name: string; qty: number; total: number }>();

  for (const o of settled) {
    r.sales += o.total;
    r.subtotal += o.subtotal;
    r.discount += o.discount;
    r.sst += o.sst;
    r.service += o.serviceCharge;
    add(byType, o.orderType, o.total);
    add(byCustomer, o.customerType, o.total);
    add(bySource, o.source, o.total);
    const paidAt = o.paidAt ?? o.createdAt;
    hours[myHour(paidAt)].total += o.total;
    hours[myHour(paidAt)].n += 1;
    const d = myDate(paidAt);
    const day = days.get(d) ?? { total: 0, n: 0 };
    day.total += o.total;
    day.n += 1;
    days.set(d, day);
    for (const it of o.items ?? []) {
      const row = items.get(it.name) ?? { name: it.name, qty: 0, total: 0 };
      row.qty += it.qty;
      row.total += it.lineTotal;
      items.set(it.name, row);
    }
  }
  for (const p of pays) if (p.kind === "order") add(byMethod, p.method, p.amount);

  const cancelled = created.filter((o) => o.status === "cancelled");

  return {
    ...r,
    orders: settled.length,
    cancelled: { n: cancelled.length, total: cancelled.reduce((s, o) => s + o.total, 0) },
    byType,
    byCustomer,
    bySource,
    byMethod,
    byHour: hours,
    byDay: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ d, ...v })),
    topItems: [...items.values()].sort((a, b) => b.qty - a.qty).slice(0, 8),
  };
}
