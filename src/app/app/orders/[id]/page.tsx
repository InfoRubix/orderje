import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { customers, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getOrder, outstandingCredit } from "@/lib/orders";
import { rm } from "@/lib/money";
import { CUSTOMER_TYPE_LABEL, METHOD_LABEL, ORDER_TYPE_LABEL } from "@/lib/pricing";
import { fmtDateTime } from "@/lib/time";
import { Badge, Card } from "@/components/ui";
import { PaymentPanel, OrderControls } from "./panel";

export const dynamic = "force-dynamic";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, tenant } = await requireUser(["owner", "cashier"]);
  const order = await getOrder(tenant.id, id);
  if (!order) notFound();

  const custList = await db
    .select({ id: customers.id, type: customers.type, name: customers.name, phone: customers.phone, company: customers.company, creditLimit: customers.creditLimit })
    .from(customers)
    .where(and(eq(customers.tenantId, tenant.id), eq(customers.active, true)))
    .orderBy(asc(customers.name));
  const owing = order.customerType === "corporate" && order.customerId ? await outstandingCredit(tenant.id, order.customerId) : 0;
  const staffNames = new Map(
    (await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.tenantId, tenant.id))).map((u) => [u.id, u.name]),
  );
  const settled = order.paymentStatus === "paid" || order.paymentStatus === "credit";

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/pos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" /> Counter
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            #{order.orderNo} {order.tableLabel ?? ORDER_TYPE_LABEL[order.orderType]}
          </h1>
          <p className="text-sm text-ink-soft">
            {fmtDateTime(order.createdAt)} · {order.source === "qr" ? "QR order" : "Counter order"} · {ORDER_TYPE_LABEL[order.orderType]}
            {order.customerName ? ` · ${order.customerName}` : ""}
            {order.customerPhone ? ` · ${order.customerPhone}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge tone={order.status === "cancelled" ? "red" : order.status === "served" ? "neutral" : "amber"} className="capitalize">
            {order.status}
          </Badge>
          <Badge tone={settled ? "green" : order.paymentStatus === "pending" ? "amber" : "red"} className="capitalize">
            {order.paymentStatus === "credit" ? "On credit" : order.paymentStatus}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <Card className="p-5">
            <ul className="divide-y divide-line">
              {order.items.map((it) => (
                <li key={it.id} className="flex gap-3 py-2.5">
                  <span className="num w-8 font-bold">{it.qty}×</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{it.name}</p>
                    {it.modifiers ? <p className="text-sm text-ink-soft">{it.modifiers}</p> : null}
                    {it.note ? <p className="text-sm italic text-ink-soft">“{it.note}”</p> : null}
                  </div>
                  <span className="num">{rm(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
            {order.note ? <p className="mt-3 rounded-lg bg-teh-soft px-3 py-2 text-sm text-teh">Note: {order.note}</p> : null}
          </Card>

          {order.payments.length ? (
            <Card className="p-5">
              <h2 className="mb-2 font-display text-lg font-bold">Payment history</h2>
              <ul className="divide-y divide-line text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-semibold">{METHOD_LABEL[p.method]}</span>
                    <span className="num">{rm(p.amount)}</span>
                    <Badge tone={p.status === "success" ? "green" : p.status === "pending" ? "amber" : "neutral"}>{p.status}</Badge>
                    <span className="w-full text-ink-soft">
                      {fmtDateTime(p.confirmedAt ?? p.createdAt)}
                      {p.tendered ? ` · received ${rm(p.tendered)}, change ${rm(p.changeGiven ?? 0)}` : ""}
                      {p.reference ? ` · ${p.reference}` : ""}
                      {p.receivedBy ? ` · by ${staffNames.get(p.receivedBy) ?? "staff"}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <OrderControls orderId={order.id} status={order.status} settled={settled} isOwner={user.role === "owner"} />
        </div>

        <PaymentPanel
          order={{
            id: order.id,
            publicToken: order.publicToken,
            customerType: order.customerType,
            customerId: order.customerId,
            subtotal: order.subtotal,
            discount: order.discount,
            serviceCharge: order.serviceCharge,
            sst: order.sst,
            rounding: order.rounding,
            total: order.total,
            paymentStatus: order.paymentStatus,
            status: order.status,
          }}
          customers={custList}
          owing={owing}
          labels={CUSTOMER_TYPE_LABEL}
          qrConfigured={Boolean(tenant.duitnowQrUrl)}
        />
      </div>
    </div>
  );
}
