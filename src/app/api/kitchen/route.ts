import { NextResponse } from "next/server";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, users } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const [u] = await db.select({ active: users.active }).from(users).where(eq(users.id, s.uid)).limit(1);
  if (!u?.active) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const since = new Date(Date.now() - 18 * 60 * 60 * 1000);
  const list = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.tenantId, s.tid), inArray(orders.status, ["new", "preparing", "ready"]), gte(orders.createdAt, since)),
    )
    .orderBy(asc(orders.createdAt))
    .limit(80);
  const items = list.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, list.map((o) => o.id)))
    : [];

  return NextResponse.json({
    now: Date.now(),
    orders: list.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      status: o.status,
      orderType: o.orderType,
      source: o.source,
      tableLabel: o.tableLabel,
      customerName: o.customerName,
      note: o.note,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt.getTime(),
      items: items
        .filter((i) => i.orderId === o.id)
        .map((i) => ({ id: i.id, name: i.name, qty: i.qty, modifiers: i.modifiers, note: i.note })),
    })),
  });
}
