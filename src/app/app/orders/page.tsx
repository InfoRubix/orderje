import Link from "next/link";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { rm } from "@/lib/money";
import { CUSTOMER_TYPE_LABEL, ORDER_TYPE_LABEL } from "@/lib/pricing";
import { dayRange, fmtTime, isValidDate, myDate } from "@/lib/time";
import { Badge, buttonVariants, Empty, Input, PageHeader } from "@/components/ui";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const PAY_TONE = { paid: "green", credit: "green", pending: "amber", unpaid: "red" } as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { tenant } = await requireUser(["owner", "cashier"]);
  const sp = await searchParams;
  const date = isValidDate(sp.date) ? sp.date : myDate();
  const { start, end } = dayRange(date);
  const list = await db
    .select()
    .from(orders)
    .where(and(eq(orders.tenantId, tenant.id), gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .orderBy(desc(orders.createdAt));

  return (
    <div>
      <PageHeader
        title="Orders"
        sub={`${list.length} order(s) placed on ${date}`}
        actions={
          <form className="flex gap-2">
            <Input type="date" name="date" defaultValue={date} max={myDate()} aria-label="Date" />
            <button className={buttonVariants({ variant: "secondary" })}>Show</button>
          </form>
        }
      />
      {list.length === 0 ? (
        <Empty title="No orders on this day" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left text-ink-soft">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Where</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Payment</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((o) => (
                <tr key={o.id} className="hover:bg-paper">
                  <td className="num px-4 py-2.5 font-semibold">
                    <Link href={`/app/orders/${o.id}`} className="hover:underline">
                      {o.orderNo}
                    </Link>
                  </td>
                  <td className="num px-4 py-2.5">{fmtTime(o.createdAt)}</td>
                  <td className="px-4 py-2.5">{o.tableLabel ?? ORDER_TYPE_LABEL[o.orderType]}</td>
                  <td className="px-4 py-2.5">
                    {CUSTOMER_TYPE_LABEL[o.customerType]}
                    {o.customerName ? <span className="text-ink-soft"> · {o.customerName}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 uppercase text-ink-soft">{o.source}</td>
                  <td className="px-4 py-2.5 capitalize">{o.status}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={o.status === "cancelled" ? "neutral" : PAY_TONE[o.paymentStatus]} className="capitalize">
                      {o.status === "cancelled" ? "—" : o.paymentStatus === "credit" ? "on credit" : o.paymentStatus}
                    </Badge>
                  </td>
                  <td className="num px-4 py-2.5 text-right font-semibold">{rm(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
