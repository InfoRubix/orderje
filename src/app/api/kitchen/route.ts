import { NextResponse } from "next/server";
import { col, readAll } from "@/db";
import type { Order } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const u = await getUser(s.uid);
  if (!u?.active || u.tenantId !== s.tid) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const since = new Date(Date.now() - 18 * 60 * 60 * 1000);
  const recent = readAll<Order>(await col.of(s.tid, "orders").where("createdAt", ">=", since).orderBy("createdAt", "asc").get());
  const list = recent.filter((o) => o.status === "new" || o.status === "preparing" || o.status === "ready").slice(0, 80);

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
      items: (o.items ?? []).map((i) => ({ id: i.id, name: i.name, qty: i.qty, modifiers: i.modifiers, note: i.note })),
    })),
  });
}
