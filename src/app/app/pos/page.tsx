import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrderRow } from "@/lib/orders";
import { ordersCreatedBetween, ordersPaidBetween, pendingPayments } from "@/lib/repo";
import { rm } from "@/lib/money";
import { CUSTOMER_TYPE_LABEL, METHOD_LABEL, ORDER_TYPE_LABEL } from "@/lib/pricing";
import { minutesAgo } from "@/lib/time";
import { buttonVariants, Badge, Empty, PageHeader } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { PendingRow } from "./pending";

export const metadata = { title: "Counter" };
export const dynamic = "force-dynamic";

const STATUS_TONE = { new: "amber", preparing: "amber", ready: "green", served: "neutral", cancelled: "red" } as const;

export default async function PosPage() {
  const { tenant } = await requireUser(["owner", "cashier"]);
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const [pays, recent, paid] = await Promise.all([
    pendingPayments(tenant.id),
    ordersCreatedBetween(tenant.id, since),
    ordersPaidBetween(tenant.id, new Date(Date.now() - 2 * 60 * 60 * 1000)),
  ]);
  const pending = (
    await Promise.all(
      pays.map(async (pay) => {
        const order = pay.orderId ? await getOrderRow(tenant.id, pay.orderId) : undefined;
        return order ? { pay, order } : null;
      }),
    )
  ).filter((x) => x !== null);

  const unpaid = recent.filter((o) => o.paymentStatus === "unpaid" && o.status !== "cancelled");

  const byTable = unpaid.filter((o) => o.tableLabel);
  const others = unpaid.filter((o) => !o.tableLabel);
  const recentPaid = paid.slice(0, 8);

  return (
    <div>
      <AutoRefresh every={5000} />
      <PageHeader
        title="Counter"
        sub="Unpaid bills, payments to confirm, and new orders."
        actions={
          <Link href="/app/pos/new" className={buttonVariants({ size: "lg" })}>
            <Plus className="size-5" aria-hidden /> New order
          </Link>
        }
      />

      {pending.length ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-bold text-teh">Confirm payments ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map(({ pay, order }) => (
              <PendingRow
                key={pay.id}
                paymentId={pay.id}
                method={pay.method}
                methodLabel={METHOD_LABEL[pay.method]}
                amount={pay.amount}
                orderNo={order.orderNo}
                where={order.tableLabel ?? ORDER_TYPE_LABEL[order.orderType]}
                minutes={minutesAgo(pay.createdAt)}
                orderId={order.id}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-bold">Unpaid bills ({unpaid.length})</h2>
        {unpaid.length === 0 ? (
          <Empty title="All bills are settled">New QR orders show up here until they&apos;re paid.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[...byTable, ...others].map((o) => (
              <Link
                key={o.id}
                href={`/app/orders/${o.id}`}
                className="group rounded-xl border border-line bg-surface p-4 hover:border-pandan"
              >
                <div className="flex items-start justify-between">
                  <p className="font-display text-lg font-bold">{o.tableLabel ?? ORDER_TYPE_LABEL[o.orderType]}</p>
                  <Badge tone={STATUS_TONE[o.status]} className="capitalize">
                    {o.status}
                  </Badge>
                </div>
                <p className="num text-sm text-ink-soft">
                  #{o.orderNo} · {minutesAgo(o.createdAt)} min ago
                  {o.customerName ? ` · ${o.customerName}` : ""}
                </p>
                <p className="num mt-3 text-2xl font-bold">{rm(o.total)}</p>
                <p className="text-xs text-mute">
                  {CUSTOMER_TYPE_LABEL[o.customerType]} · {o.source === "qr" ? "QR order" : "Counter order"}
                </p>
                <p className="mt-3 text-sm font-semibold text-pandan group-hover:underline">Take payment</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {recentPaid.length ? (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Just paid</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {recentPaid.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <Link href={`/app/orders/${o.id}`} className="font-semibold hover:underline">
                  #{o.orderNo} {o.tableLabel ?? ORDER_TYPE_LABEL[o.orderType]}
                </Link>
                <span className="num">{rm(o.total)}</span>
                <a href={`/r/${o.publicToken}?print=1`} target="_blank" className="font-semibold text-pandan hover:underline">
                  Print receipt
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
