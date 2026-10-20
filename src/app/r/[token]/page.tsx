import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { getOrderByToken } from "@/lib/orders";
import { rm } from "@/lib/money";
import { CUSTOMER_TYPE_LABEL, METHOD_LABEL, ORDER_TYPE_LABEL } from "@/lib/pricing";
import { fmtDateTime } from "@/lib/time";
import { appUrl } from "@/lib/utils";
import { ReceiptActions } from "./actions-bar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receipt" };

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { token } = await params;
  const { print } = await searchParams;
  const order = await getOrderByToken(token);
  if (!order) notFound();
  const [t] = await db.select().from(tenants).where(eq(tenants.id, order.tenantId));
  const paid = order.payments.filter((p) => p.status === "success");
  const settled = order.paymentStatus === "paid" || order.paymentStatus === "credit";

  return (
    <main className="min-h-dvh bg-paper py-6 print:bg-white print:py-0">
      <ReceiptActions
        autoPrint={print === "1"}
        shareText={`Receipt ${t.name} #${order.orderNo}: ${appUrl()}/r/${order.publicToken}`}
      />
      <article className="slip mx-auto w-[80mm] max-w-full px-4 pb-6 pt-5 font-mono text-[12px] leading-snug text-ink print:shadow-none print:after:hidden">
        <header className="text-center">
          <p className="font-sans text-base font-bold">{t.name}</p>
          {t.address ? <p>{t.address}</p> : null}
          {t.phone ? <p>Tel {t.phone}</p> : null}
        </header>
        <div className="my-3 border-t border-dashed border-ink/40" />
        <p className="flex justify-between">
          <span>Order #{order.orderNo}</span>
          <span>{ORDER_TYPE_LABEL[order.orderType]}</span>
        </p>
        <p>{fmtDateTime(order.paidAt ?? order.createdAt)}</p>
        {order.tableLabel ? <p>{order.tableLabel}</p> : null}
        <p>
          {CUSTOMER_TYPE_LABEL[order.customerType]}
          {order.customerName ? `: ${order.customerName}` : ""}
        </p>
        <div className="my-3 border-t border-dashed border-ink/40" />
        <ul className="space-y-1.5">
          {order.items.map((it) => (
            <li key={it.id}>
              <p className="flex justify-between gap-2">
                <span>
                  {it.qty} x {it.name}
                </span>
                <span className="shrink-0">{(it.lineTotal / 100).toFixed(2)}</span>
              </p>
              {it.modifiers ? <p className="pl-4 text-ink-soft">{it.modifiers}</p> : null}
            </li>
          ))}
        </ul>
        <div className="my-3 border-t border-dashed border-ink/40" />
        <dl className="space-y-0.5">
          <L k="Subtotal" v={order.subtotal} />
          {order.discount ? <L k={`Discount (${CUSTOMER_TYPE_LABEL[order.customerType]})`} v={-order.discount} /> : null}
          {order.serviceCharge ? <L k="Service charge" v={order.serviceCharge} /> : null}
          {order.sst ? <L k="SST" v={order.sst} /> : null}
          {order.rounding ? <L k="Rounding" v={order.rounding} /> : null}
          <div className="flex justify-between pt-1 text-sm font-bold">
            <dt>TOTAL</dt>
            <dd>{rm(order.total)}</dd>
          </div>
        </dl>
        <div className="my-3 border-t border-dashed border-ink/40" />
        {settled ? (
          paid.map((p) => (
            <div key={p.id} className="space-y-0.5">
              <L k={METHOD_LABEL[p.method]} v={p.method === "cash" ? p.tendered ?? p.amount : p.amount} />
              {p.method === "cash" && p.changeGiven ? <L k="Change" v={p.changeGiven} /> : null}
              {p.reference ? <p className="text-ink-soft">Ref {p.reference}</p> : null}
            </div>
          ))
        ) : (
          <p className="text-center font-bold">UNPAID</p>
        )}
        <div className="my-3 border-t border-dashed border-ink/40" />
        <p className="text-center">{t.receiptFooter || "Terima kasih, datang lagi!"}</p>
      </article>
    </main>
  );
}

function L({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between">
      <dt>{k}</dt>
      <dd>{(v / 100).toFixed(2)}</dd>
    </div>
  );
}
