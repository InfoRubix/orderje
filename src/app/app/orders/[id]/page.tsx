import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrder, outstandingCredit } from "@/lib/orders";
import { listCustomers, listUsers } from "@/lib/repo";
import { rm } from "@/lib/money";
import { CUSTOMER_TYPE_LABEL, METHOD_LABEL, ORDER_TYPE_LABEL } from "@/lib/pricing";
import { fmtDateTime } from "@/lib/time";
import { makeT } from "@/lib/i18n";
import { Badge, Card } from "@/components/ui";
import { PaymentPanel, OrderControls } from "./panel";

export const dynamic = "force-dynamic";

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, tenant } = await requireUser(["owner", "cashier"]);
  const t = makeT(tenant.language);
  const order = await getOrder(tenant.id, id);
  if (!order) notFound();

  const custList = (await listCustomers(tenant.id, { activeOnly: true })).map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    phone: c.phone,
    company: c.company,
    creditLimit: c.creditLimit,
  }));
  const owing = order.customerType === "corporate" && order.customerId ? await outstandingCredit(tenant.id, order.customerId) : 0;
  const staffNames = new Map(
    (await listUsers(tenant.id)).map((u) => [u.id, u.name]),
  );
  const settled = order.paymentStatus === "paid" || order.paymentStatus === "credit";

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/pos" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" /> {t("Counter")}
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">
            #{order.orderNo} {order.tableLabel ?? t(ORDER_TYPE_LABEL[order.orderType])}
          </h1>
          <p className="text-sm text-ink-soft">
            {fmtDateTime(order.createdAt, tenant.language)} · {order.source === "qr" ? t("QR order") : t("Counter order")} · {t(ORDER_TYPE_LABEL[order.orderType])}
            {order.customerName ? ` · ${order.customerName}` : ""}
            {order.customerPhone ? ` · ${order.customerPhone}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge tone={order.status === "cancelled" ? "red" : order.status === "served" ? "neutral" : "amber"}>
            {t(order.status)}
          </Badge>
          <Badge tone={settled ? "green" : "red"}>
            {order.paymentStatus === "credit" ? t("On credit") : t(order.paymentStatus)}
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
            {order.note ? <p className="mt-3 rounded-lg bg-teh-soft px-3 py-2 text-sm text-teh">{t("Note: {note}", { note: order.note })}</p> : null}
          </Card>

          {order.payments.length ? (
            <Card className="p-5">
              <h2 className="mb-2 font-display text-lg font-bold">{t("Payment history")}</h2>
              <ul className="divide-y divide-line text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-semibold">{t(METHOD_LABEL[p.method])}</span>
                    <span className="num">{rm(p.amount)}</span>
                    <Badge tone={p.status === "success" ? "green" : "neutral"}>{p.status === "failed" ? t("voided") : t("paid")}</Badge>
                    <span className="w-full text-ink-soft">
                      {fmtDateTime(p.confirmedAt ?? p.createdAt, tenant.language)}
                      {p.tendered ? ` · ${t("received {tendered}, change {change}", { tendered: rm(p.tendered), change: rm(p.changeGiven ?? 0) })}` : ""}
                      {p.reference ? ` · ${p.reference}` : ""}
                      {p.receivedBy ? ` · ${t("by {name}", { name: staffNames.get(p.receivedBy) ?? t("staff") })}` : ""}
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
        />
      </div>
    </div>
  );
}
