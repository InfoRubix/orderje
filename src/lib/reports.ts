import "server-only";
import { and, desc, eq, gte, inArray, lt, ne, sql, sum, count } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, payments, reconciliations, type CustomerType, type OrderType, type PaymentMethod } from "@/db/schema";
import { dayRange } from "./time";

const METHODS: PaymentMethod[] = ["cash", "duitnow_qr", "online", "credit"];
const zeroMethods = () => ({ cash: 0, duitnow_qr: 0, online: 0, credit: 0 }) as Record<PaymentMethod, number>;

/**
 * Money received on one business date, counted by when the payment was confirmed
 * (a dinner order paid after midnight lands on the next day, like the cash drawer).
 */
export async function reconSummary(tenantId: string, date: string) {
  const { start, end } = dayRange(date);
  const inDay = and(eq(payments.tenantId, tenantId), eq(payments.status, "success"), gte(payments.confirmedAt, start), lt(payments.confirmedAt, end));

  const rows = await db
    .select({ kind: payments.kind, method: payments.method, total: sum(payments.amount), n: count() })
    .from(payments)
    .where(inDay)
    .groupBy(payments.kind, payments.method);

  const byMethod = zeroMethods();
  const countByMethod = zeroMethods();
  const settlements = zeroMethods();
  for (const r of rows) {
    if (r.kind === "order") {
      byMethod[r.method] += Number(r.total ?? 0);
      countByMethod[r.method] += Number(r.n);
    } else settlements[r.method] += Number(r.total ?? 0);
  }

  const [open] = await db
    .select({ n: count() })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        gte(orders.createdAt, start),
        lt(orders.createdAt, end),
        ne(orders.status, "cancelled"),
        inArray(orders.paymentStatus, ["unpaid", "pending"]),
      ),
    );

  const cashLines = await db
    .select({
      id: payments.id,
      orderId: payments.orderId,
      method: payments.method,
      kind: payments.kind,
      amount: payments.amount,
      reference: payments.reference,
      confirmedAt: payments.confirmedAt,
      orderNo: orders.orderNo,
    })
    .from(payments)
    .leftJoin(orders, eq(orders.id, payments.orderId))
    .where(and(inDay, inArray(payments.method, ["duitnow_qr", "online"])))
    .orderBy(payments.confirmedAt);

  const [closed] = await db
    .select()
    .from(reconciliations)
    .where(and(eq(reconciliations.tenantId, tenantId), eq(reconciliations.businessDate, date)))
    .limit(1);

  return {
    date,
    byMethod,
    countByMethod,
    settlements,
    collected: METHODS.filter((m) => m !== "credit").reduce((s, m) => s + byMethod[m] + settlements[m], 0),
    openOrders: Number(open?.n ?? 0),
    electronic: cashLines,
    closed: closed ?? null,
  };
}

/** Sales for a date range [from, to] inclusive, counted on orders settled in the range. */
export async function salesReport(tenantId: string, from: string, to: string) {
  const start = dayRange(from).start;
  const end = dayRange(to).end;
  const settled = and(
    eq(orders.tenantId, tenantId),
    inArray(orders.paymentStatus, ["paid", "credit"]),
    gte(orders.paidAt, start),
    lt(orders.paidAt, end),
  );

  const [totals] = await db
    .select({
      sales: sum(orders.total),
      subtotal: sum(orders.subtotal),
      discount: sum(orders.discount),
      sst: sum(orders.sst),
      service: sum(orders.serviceCharge),
      n: count(),
    })
    .from(orders)
    .where(settled);

  const byType = await db
    .select({ k: orders.orderType, total: sum(orders.total), n: count() })
    .from(orders)
    .where(settled)
    .groupBy(orders.orderType);

  const byCustomer = await db
    .select({ k: orders.customerType, total: sum(orders.total), n: count() })
    .from(orders)
    .where(settled)
    .groupBy(orders.customerType);

  const bySource = await db
    .select({ k: orders.source, total: sum(orders.total), n: count() })
    .from(orders)
    .where(settled)
    .groupBy(orders.source);

  const methodRows = await db
    .select({ k: payments.method, total: sum(payments.amount), n: count() })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tenantId),
        eq(payments.kind, "order"),
        eq(payments.status, "success"),
        gte(payments.confirmedAt, start),
        lt(payments.confirmedAt, end),
      ),
    )
    .groupBy(payments.method);

  // Hour of day in Malaysia time, for the busy-hours chart.
  const myHour = sql<number>`HOUR(DATE_ADD(${orders.paidAt}, INTERVAL 8 HOUR))`;
  const byHour = await db
    .select({ h: myHour, total: sum(orders.total), n: count() })
    .from(orders)
    .where(settled)
    .groupBy(myHour);

  const myDay = sql<string>`DATE_FORMAT(DATE_ADD(${orders.paidAt}, INTERVAL 8 HOUR), '%Y-%m-%d')`;
  const byDay = await db
    .select({ d: myDay, total: sum(orders.total), n: count() })
    .from(orders)
    .where(settled)
    .groupBy(myDay)
    .orderBy(myDay);

  const topItems = await db
    .select({ name: orderItems.name, qty: sum(orderItems.qty), total: sum(orderItems.lineTotal) })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(settled)
    .groupBy(orderItems.name)
    .orderBy(desc(sum(orderItems.qty)))
    .limit(8);

  const [cancelled] = await db
    .select({ n: count(), total: sum(orders.total) })
    .from(orders)
    .where(and(eq(orders.tenantId, tenantId), eq(orders.status, "cancelled"), gte(orders.createdAt, start), lt(orders.createdAt, end)));

  const num = (v: unknown) => Number(v ?? 0);
  return {
    sales: num(totals?.sales),
    subtotal: num(totals?.subtotal),
    discount: num(totals?.discount),
    sst: num(totals?.sst),
    service: num(totals?.service),
    orders: num(totals?.n),
    cancelled: { n: num(cancelled?.n), total: num(cancelled?.total) },
    byType: Object.fromEntries(byType.map((r) => [r.k, { total: num(r.total), n: num(r.n) }])) as Partial<Record<OrderType, { total: number; n: number }>>,
    byCustomer: Object.fromEntries(byCustomer.map((r) => [r.k, { total: num(r.total), n: num(r.n) }])) as Partial<Record<CustomerType, { total: number; n: number }>>,
    bySource: Object.fromEntries(bySource.map((r) => [r.k, { total: num(r.total), n: num(r.n) }])) as Partial<Record<"qr" | "counter", { total: number; n: number }>>,
    byMethod: Object.fromEntries(methodRows.map((r) => [r.k, { total: num(r.total), n: num(r.n) }])) as Partial<Record<PaymentMethod, { total: number; n: number }>>,
    byHour: Array.from({ length: 24 }, (_, h) => {
      const r = byHour.find((x) => Number(x.h) === h);
      return { h, total: num(r?.total), n: num(r?.n) };
    }),
    byDay: byDay.map((r) => ({ d: String(r.d), total: num(r.total), n: num(r.n) })),
    topItems: topItems.map((r) => ({ name: r.name, qty: num(r.qty), total: num(r.total) })),
  };
}
