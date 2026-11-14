import { NextResponse } from "next/server";
import { col, readAll } from "@/db";
import type { Order } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getUser } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** Order numbers for the calling screen: what's being made and what's ready to collect. */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const u = await getUser(s.uid);
  if (!u?.active || u.tenantId !== s.tid) return NextResponse.json({ error: "unauthorised" }, { status: 401 });

  const since = new Date(Date.now() - 18 * 60 * 60 * 1000);
  const recent = readAll<Order>(await col.of(s.tid, "orders").where("createdAt", ">=", since).orderBy("createdAt", "asc").get());
  const show = (o: Order) => ({
    id: o.id,
    orderNo: o.orderNo,
    // Takeaway is called by name if they gave one; dine-in by table.
    label: o.tableLabel ?? o.customerName ?? null,
  });
  return NextResponse.json({
    preparing: recent.filter((o) => o.status === "new" || o.status === "preparing").map(show).slice(-40),
    ready: recent.filter((o) => o.status === "ready").map(show).slice(-24),
  });
}
