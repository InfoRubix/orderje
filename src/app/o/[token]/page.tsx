import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChefHat, Clock, HandPlatter, XCircle } from "lucide-react";
import type { OrderStatus } from "@/db/schema";
import { makeT } from "@/lib/i18n";
import { getOrderByToken } from "@/lib/orders";
import { getTenant } from "@/lib/repo";
import { rm } from "@/lib/money";
import { ORDER_TYPE_LABEL } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { AutoRefresh } from "@/components/auto-refresh";
import { brandStyle } from "@/lib/brand";
import { ShopLogo } from "@/components/thumb";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  const tenant = order ? await getTenant(order.tenantId) : undefined;
  return { title: makeT(tenant?.language ?? "en")("Your order") };
}

const STEPS: { key: OrderStatus; label: string; icon: typeof Clock }[] = [
  { key: "new", label: "Received", icon: Clock },
  { key: "preparing", label: "Cooking", icon: ChefHat },
  { key: "ready", label: "Ready", icon: HandPlatter },
  { key: "served", label: "Served", icon: CheckCircle2 },
];

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) notFound();
  const tenant = await getTenant(order.tenantId);
  if (!tenant) notFound();
  const t = makeT(tenant.language);
  const stepIdx = STEPS.findIndex((s) => s.key === order.status);
  const settled = order.paymentStatus === "paid" || order.paymentStatus === "credit";
  const done = order.status === "cancelled" || (order.status === "served" && settled);

  return (
    <main className="brand mx-auto min-h-dvh max-w-xl pb-10" style={brandStyle(tenant.brandColor)}>
      <AutoRefresh every={5000} enabled={!done} />
      <header className="border-b-4 border-edge bg-pandan px-5 pb-6 pt-6 text-on-brand">
        <p className="flex items-center gap-2 text-sm opacity-80">
          <ShopLogo name={tenant.name} src={tenant.logoUrl} className="size-7 rounded-md text-sm" />
          {tenant.name}
        </p>
        <h1 className="mt-1 font-display text-5xl">{t("Order #{n}", { n: order.orderNo })}</h1>
        <p className="mt-1 opacity-85">
          {t(ORDER_TYPE_LABEL[order.orderType])}
          {order.tableLabel ? `, ${order.tableLabel}` : ""}
          {order.customerName ? `, ${order.customerName}` : ""}
        </p>
      </header>

      <div className="space-y-5 px-4 pt-5">
        {order.status === "cancelled" ? (
          <div className="flex items-center gap-3 rounded-xl bg-chili-soft p-4 text-chili">
            <XCircle className="size-6 shrink-0" aria-hidden />
            <p className="font-semibold">{t("This order was cancelled by the kedai. Please check with the counter.")}</p>
          </div>
        ) : (
          <ol className="grid grid-cols-4 gap-2" aria-label={t("Order progress")}>
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const reached = i <= stepIdx;
              return (
                <li key={s.key} className="text-center">
                  <span
                    className={cn(
                      "mx-auto grid size-11 place-items-center rounded-sm",
                      reached ? "bg-pandan text-on-brand" : "bg-line text-mute",
                      i === stepIdx && "ring-4 ring-tag",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className={cn("mt-1.5 block text-xs font-semibold", reached ? "text-ink" : "text-mute")}>
                    {t(s.label)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <section className="slip rounded-t-lg px-5 pb-6 pt-4">
          <ul className="divide-y divide-dashed divide-line">
            {order.items.map((it) => (
              <li key={it.id} className="flex gap-3 py-2.5">
                <span className="num w-6 font-bold">{it.qty}×</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{it.name}</p>
                  {it.modifiers ? <p className="text-sm text-ink-soft">{it.modifiers}</p> : null}
                  {it.note ? <p className="text-sm italic text-ink-soft">“{it.note}”</p> : null}
                </div>
                <span className="num text-sm">{rm(it.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <dl className="num mt-3 space-y-1 border-t border-dashed border-line pt-3 text-sm">
            <Line label={t("Subtotal")} v={order.subtotal} />
            {order.discount ? <Line label={t("Discount")} v={-order.discount} /> : null}
            {order.serviceCharge ? <Line label={t("Service charge")} v={order.serviceCharge} /> : null}
            {order.sst ? <Line label={t("SST")} v={order.sst} /> : null}
            {order.rounding ? <Line label={t("Rounding")} v={order.rounding} /> : null}
            <div className="flex justify-between pt-1 text-lg font-bold">
              <dt>{t("Total")}</dt>
              <dd>{rm(order.total)}</dd>
            </div>
          </dl>
        </section>

        {order.status !== "cancelled" ? (
          settled ? (
            <div className="rounded-xl border border-pandan/30 bg-pandan-soft p-4">
              <p className="font-semibold text-pandan-dark">
                {order.paymentStatus === "credit" ? t("Charged to your company account.") : t("Paid. Terima kasih!")}
              </p>
              <Link href={`/r/${order.publicToken}`} className="mt-1 inline-block text-sm font-bold text-ink underline decoration-tag decoration-[3px] underline-offset-4">
                {t("View receipt")}
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-edge bg-surface p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{t("Please pay at the counter")}</p>
              <p className="num font-display tag mt-2 text-5xl">{rm(order.total)}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {t("Cash or DuitNow QR. Show order #{n} to the cashier.", { n: order.orderNo })}
              </p>
            </div>
          )
        ) : null}

        <p className="text-center text-xs text-mute">{t("Keep this page open. It updates by itself.")}</p>
      </div>
    </main>
  );
}

function Line({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{label}</dt>
      <dd>{rm(v)}</dd>
    </div>
  );
}
