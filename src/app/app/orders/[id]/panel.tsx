"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CustomerType, OrderStatus, PaymentStatus } from "@/db/schema";
import { cashRound, rm } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button, Card, FormError, Input, Select } from "@/components/ui";
import { useT } from "@/components/i18n";
import { changeOrderCustomer, setOrderStatus, takePayment, voidPayment } from "../../actions";

type Cust = { id: string; type: string; name: string; phone: string | null; company: string | null; creditLimit: number };

export function PaymentPanel({
  order,
  customers,
  owing,
  labels,
}: {
  order: {
    id: string;
    publicToken: string;
    customerType: CustomerType;
    customerId: string | null;
    subtotal: number;
    discount: number;
    serviceCharge: number;
    sst: number;
    rounding: number;
    total: number;
    paymentStatus: PaymentStatus;
    status: OrderStatus;
  };
  customers: Cust[];
  owing: number;
  labels: Record<CustomerType, string>;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();
  const [type, setType] = useState<CustomerType>(order.customerType);
  const [custId, setCustId] = useState(order.customerId ?? "");
  const [method, setMethod] = useState<"cash" | "duitnow_qr" | "credit">(order.customerType === "corporate" ? "credit" : "cash");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [done, setDone] = useState<{ change: number | null } | null>(null);

  const settled = order.paymentStatus === "paid" || order.paymentStatus === "credit";
  const locked = settled || order.status === "cancelled";
  const customerChanged = type !== order.customerType || (type !== "walk_in" && custId !== (order.customerId ?? ""));
  const cashDue = cashRound(order.total);
  const tSen = Math.round(Number(tendered || 0) * 100);
  const quick = [...new Set([cashDue, ...[1000, 2000, 5000, 10000].map((n) => Math.ceil(cashDue / n) * n)])].filter((v) => v >= cashDue).slice(0, 4);
  const corp = customers.find((c) => c.id === order.customerId);

  function applyCustomer() {
    start(async () => {
      setError(undefined);
      const r = await changeOrderCustomer(order.id, type, type === "walk_in" ? null : custId || null);
      if (r?.error) setError(r.error);
      else {
        setMethod(type === "corporate" ? "credit" : "cash");
        router.refresh();
      }
    });
  }

  function pay() {
    start(async () => {
      setError(undefined);
      const r = await takePayment(order.id, method, method === "cash" ? tendered : "", reference);
      if (r?.error) setError(r.error);
      else {
        setDone({ change: r.change ?? null });
        router.refresh();
      }
    });
  }

  if (done || settled) {
    return (
      <Card className="h-fit space-y-4 p-5 lg:sticky lg:top-6">
        <p className="font-display text-xl font-bold text-pandan-dark">
          {order.paymentStatus === "credit" ? t("Charged to company account") : t("Paid")}
        </p>
        {done?.change ? (
          <div className="rounded-xl bg-ink p-4 text-on-ink">
            <p className="text-sm opacity-70">{t("Give change")}</p>
            <p className="num font-display text-4xl font-bold">{rm(done.change)}</p>
          </div>
        ) : null}
        <Totals order={order} />
        <div className="flex flex-col gap-2">
          <a
            href={`/r/${order.publicToken}?print=1`}
            target="_blank"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-pandan font-semibold text-white"
          >
            {t("Print receipt")}
          </a>
          <Button variant="secondary" size="lg" onClick={() => router.push("/app/pos")}>
            {t("Back to counter")}
          </Button>
        </div>
      </Card>
    );
  }

  const options = customers.filter((c) => c.type === type);

  return (
    <Card className="h-fit space-y-5 p-5 lg:sticky lg:top-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-soft">{t("Customer type")}</h2>
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-paper p-1">
          {(["walk_in", "member", "staff", "corporate"] as const).map((k) => (
            <button
              key={k}
              disabled={locked}
              onClick={() => {
                setType(k);
                setCustId(k === order.customerType ? order.customerId ?? "" : "");
              }}
              aria-pressed={type === k}
              className={cn(
                "rounded-md py-2 text-xs font-semibold sm:text-sm",
                type === k ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
              )}
            >
              {t(labels[k])}
            </button>
          ))}
        </div>
        {type !== "walk_in" ? (
          <div className="mt-2">
            {options.length ? (
              <Select value={custId} onChange={(e) => setCustId(e.target.value)} disabled={locked} aria-label={t("Customer")}>
                <option value="">{t("Pick {type}…", { type: t(labels[type]).toLowerCase() })}</option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.company ? ` (${c.company})` : ""}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-sm text-ink-soft">
                {t("No {type} registered yet.", { type: t(labels[type]).toLowerCase() })}{" "}
                <a href="/app/customers" className="font-bold text-ink underline decoration-tag decoration-[3px] underline-offset-4">
                  {t("Add one")}
                </a>
              </p>
            )}
          </div>
        ) : null}
        {customerChanged ? (
          <Button className="mt-2 w-full" variant="dark" disabled={busy || (type !== "walk_in" && !custId)} onClick={applyCustomer}>
            {t("Apply {type} pricing", { type: t(labels[type]).toLowerCase() })}
          </Button>
        ) : null}
      </section>

      <Totals order={order} />

      {order.status === "cancelled" ? (
        <p className="rounded-lg bg-chili-soft p-3 text-sm font-semibold text-chili">{t("This order was cancelled.")}</p>
      ) : customerChanged ? null : (
        <section className="space-y-3">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-paper p-1">
            {(
              [
                ["cash", "Cash"],
                ["duitnow_qr", "DuitNow QR"],
                ["credit", "Credit"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                disabled={m === "credit" && order.customerType !== "corporate"}
                onClick={() => setMethod(m)}
                aria-pressed={method === m}
                className={cn(
                  "rounded-md py-2 text-sm font-semibold disabled:opacity-40",
                  method === m ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
                )}
              >
                {t(label)}
              </button>
            ))}
          </div>

          {method === "cash" ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">
                {t("Cash due")} <span className="num font-bold text-ink">{rm(cashDue)}</span>
                {cashDue !== order.total ? ` ${t("(rounded to 5 sen)")}` : ""}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {quick.map((v) => (
                  <button
                    key={v}
                    onClick={() => setTendered((v / 100).toFixed(2))}
                    className="num rounded-md border-2 border-edge py-2 text-sm font-semibold hover:bg-tag-soft"
                  >
                    {v === cashDue ? t("Exact") : (v / 100).toFixed(0)}
                  </button>
                ))}
              </div>
              <Input
                inputMode="decimal"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                placeholder={t("Cash received, e.g. 50")}
                aria-label={t("Cash received")}
                className="num h-12 text-lg"
              />
              {tendered && tSen >= cashDue ? (
                <p className="num text-right text-lg font-bold">{t("Change {amount}", { amount: rm(tSen - cashDue) })}</p>
              ) : null}
            </div>
          ) : null}

          {method === "duitnow_qr" ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">
                {t("Customer scans your DuitNow QR at the counter. Check your bank app, then enter the reference.")}
              </p>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("Bank reference (last 4–6 digits)")} />
            </div>
          ) : null}

          {method === "credit" ? (
            <p className="text-sm text-ink-soft">
              {t("Charge {amount} to {who}. Currently owing {owing}", {
                amount: rm(order.total),
                who: corp?.company || corp?.name || t("this company"),
                owing: rm(owing),
              })}
              {corp?.creditLimit ? ` ${t("of {limit} limit", { limit: rm(corp.creditLimit) })}` : ""}.
            </p>
          ) : null}

          <FormError message={error} />
          <Button
            size="xl"
            className="w-full"
            disabled={busy || (method === "cash" && !!tendered && tSen < cashDue) || (method === "duitnow_qr" && !reference.trim())}
            onClick={pay}
          >
            {busy
              ? t("Saving…")
              : method === "credit"
                ? t("Charge {amount}", { amount: rm(order.total) })
                : t("Receive {amount}", { amount: rm(method === "cash" ? cashDue : order.total) })}
          </Button>
        </section>
      )}
      {customerChanged || locked ? <FormError message={error} /> : null}
    </Card>
  );
}

function Totals({ order }: { order: { subtotal: number; discount: number; serviceCharge: number; sst: number; rounding: number; total: number } }) {
  const t = useT();
  return (
    <dl className="num space-y-1 border-y border-line py-3 text-sm">
      <Row k={t("Subtotal")} v={order.subtotal} />
      {order.discount ? <Row k={t("Discount")} v={-order.discount} /> : null}
      {order.serviceCharge ? <Row k={t("Service charge")} v={order.serviceCharge} /> : null}
      {order.sst ? <Row k={t("SST")} v={order.sst} /> : null}
      {order.rounding ? <Row k={t("Rounding")} v={order.rounding} /> : null}
      <div className="flex justify-between pt-1 text-xl font-bold">
        <dt>{t("Total")}</dt>
        <dd>{rm(order.total)}</dd>
      </div>
    </dl>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{k}</dt>
      <dd>{rm(v)}</dd>
    </div>
  );
}

export function OrderControls({
  orderId,
  status,
  settled,
  isOwner,
}: {
  orderId: string;
  status: OrderStatus;
  settled: boolean;
  isOwner: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<{ error?: string } | undefined>) =>
    start(async () => {
      setError(undefined);
      const r = await fn();
      if (r?.error) setError(r.error);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "ready" ? (
          <Button variant="secondary" disabled={busy} onClick={() => run(() => setOrderStatus(orderId, "served"))}>
            {t("Mark served")}
          </Button>
        ) : null}
        {!settled && (status === "new" || status === "preparing") ? (
          <Button
            variant="secondary"
            className="text-chili"
            disabled={busy}
            onClick={() => confirm(t("Cancel this order? The kitchen will stop it.")) && run(() => setOrderStatus(orderId, "cancelled"))}
          >
            {t("Cancel order")}
          </Button>
        ) : null}
        {settled && isOwner ? (
          <Button
            variant="ghost"
            className="text-chili"
            disabled={busy}
            onClick={() => {
              const reason = prompt(t("Void the payment? Enter a reason (e.g. refunded, wrong method):"));
              if (reason) run(() => voidPayment(orderId, reason));
            }}
          >
            {t("Void payment")}
          </Button>
        ) : null}
      </div>
      <FormError message={error} />
    </div>
  );
}
