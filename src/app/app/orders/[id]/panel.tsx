"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CustomerType, OrderStatus, PaymentStatus } from "@/db/schema";
import { cashRound, rm } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button, Card, FormError, Input, Select } from "@/components/ui";
import { changeOrderCustomer, setOrderStatus, takePayment, voidPayment } from "../../actions";

type Cust = { id: string; type: string; name: string; phone: string | null; company: string | null; creditLimit: number };

export function PaymentPanel({
  order,
  customers,
  owing,
  labels,
  qrConfigured,
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
  qrConfigured: boolean;
}) {
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
  const locked = settled || order.status === "cancelled" || order.paymentStatus === "pending";
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
          {order.paymentStatus === "credit" ? "Charged to company account" : "Paid"}
        </p>
        {done?.change ? (
          <div className="rounded-xl bg-ink p-4 text-white">
            <p className="text-sm text-white/70">Give change</p>
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
            Print receipt
          </a>
          <Button variant="secondary" size="lg" onClick={() => router.push("/app/pos")}>
            Back to counter
          </Button>
        </div>
      </Card>
    );
  }

  const options = customers.filter((c) => c.type === type);

  return (
    <Card className="h-fit space-y-5 p-5 lg:sticky lg:top-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-soft">Customer type</h2>
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-paper p-1">
          {(["walk_in", "member", "staff", "corporate"] as const).map((t) => (
            <button
              key={t}
              disabled={locked}
              onClick={() => {
                setType(t);
                setCustId(t === order.customerType ? order.customerId ?? "" : "");
              }}
              aria-pressed={type === t}
              className={cn(
                "rounded-md py-2 text-xs font-semibold sm:text-sm",
                type === t ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
              )}
            >
              {labels[t]}
            </button>
          ))}
        </div>
        {type !== "walk_in" ? (
          <div className="mt-2">
            {options.length ? (
              <Select value={custId} onChange={(e) => setCustId(e.target.value)} disabled={locked} aria-label="Customer">
                <option value="">Pick {labels[type].toLowerCase()}…</option>
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
                No {labels[type].toLowerCase()} registered yet.{" "}
                <a href="/app/customers" className="font-semibold text-pandan underline">
                  Add one
                </a>
              </p>
            )}
          </div>
        ) : null}
        {customerChanged ? (
          <Button className="mt-2 w-full" variant="dark" disabled={busy || (type !== "walk_in" && !custId)} onClick={applyCustomer}>
            Apply {labels[type].toLowerCase()} pricing
          </Button>
        ) : null}
      </section>

      <Totals order={order} />

      {order.paymentStatus === "pending" ? (
        <p className="rounded-lg bg-teh-soft p-3 text-sm font-semibold text-teh">
          The customer has a payment waiting for confirmation. Confirm or reject it on the Counter page first.
        </p>
      ) : order.status === "cancelled" ? (
        <p className="rounded-lg bg-chili-soft p-3 text-sm font-semibold text-chili">This order was cancelled.</p>
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
                {label}
              </button>
            ))}
          </div>

          {method === "cash" ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">
                Cash due <span className="num font-bold text-ink">{rm(cashDue)}</span>
                {cashDue !== order.total ? " (rounded to 5 sen)" : ""}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {quick.map((v) => (
                  <button
                    key={v}
                    onClick={() => setTendered((v / 100).toFixed(2))}
                    className="num rounded-lg border border-line py-2 text-sm font-semibold hover:border-pandan"
                  >
                    {v === cashDue ? "Exact" : (v / 100).toFixed(0)}
                  </button>
                ))}
              </div>
              <Input
                inputMode="decimal"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                placeholder="Cash received, e.g. 50"
                aria-label="Cash received"
                className="num h-12 text-lg"
              />
              {tendered && tSen >= cashDue ? (
                <p className="num text-right text-lg font-bold">Change {rm(tSen - cashDue)}</p>
              ) : null}
            </div>
          ) : null}

          {method === "duitnow_qr" ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">
                {qrConfigured
                  ? "Customer scans the DuitNow QR at the counter. Check your bank app, then enter the reference."
                  : "Upload your DuitNow QR in Settings so customers can also scan it from their order page."}
              </p>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank reference (last 4–6 digits)" />
            </div>
          ) : null}

          {method === "credit" ? (
            <p className="text-sm text-ink-soft">
              Charge {rm(order.total)} to {corp?.company || corp?.name || "this company"}. Currently owing {rm(owing)}
              {corp?.creditLimit ? ` of ${rm(corp.creditLimit)} limit` : ""}.
            </p>
          ) : null}

          <FormError message={error} />
          <Button
            size="xl"
            className="w-full"
            disabled={busy || (method === "cash" && !!tendered && tSen < cashDue) || (method === "duitnow_qr" && !reference.trim())}
            onClick={pay}
          >
            {busy ? "Saving…" : method === "credit" ? `Charge ${rm(order.total)}` : `Receive ${rm(method === "cash" ? cashDue : order.total)}`}
          </Button>
        </section>
      )}
      {customerChanged || locked ? <FormError message={error} /> : null}
    </Card>
  );
}

function Totals({ order }: { order: { subtotal: number; discount: number; serviceCharge: number; sst: number; rounding: number; total: number } }) {
  return (
    <dl className="num space-y-1 border-y border-line py-3 text-sm">
      <Row k="Subtotal" v={order.subtotal} />
      {order.discount ? <Row k="Discount" v={-order.discount} /> : null}
      {order.serviceCharge ? <Row k="Service charge" v={order.serviceCharge} /> : null}
      {order.sst ? <Row k="SST" v={order.sst} /> : null}
      {order.rounding ? <Row k="Rounding" v={order.rounding} /> : null}
      <div className="flex justify-between pt-1 text-xl font-bold">
        <dt>Total</dt>
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
            Mark served
          </Button>
        ) : null}
        {!settled && (status === "new" || status === "preparing") ? (
          <Button
            variant="secondary"
            className="text-chili"
            disabled={busy}
            onClick={() => confirm("Cancel this order? The kitchen will stop it.") && run(() => setOrderStatus(orderId, "cancelled"))}
          >
            Cancel order
          </Button>
        ) : null}
        {settled && isOwner ? (
          <Button
            variant="ghost"
            className="text-chili"
            disabled={busy}
            onClick={() => {
              const reason = prompt("Void the payment? Enter a reason (e.g. refunded, wrong method):");
              if (reason) run(() => voidPayment(orderId, reason));
            }}
          >
            Void payment
          </Button>
        ) : null}
      </div>
      <FormError message={error} />
    </div>
  );
}
