"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { rm } from "@/lib/money";
import { Button, Input } from "@/components/ui";
import { confirmPending } from "../actions";

export function PendingRow(p: {
  paymentId: string;
  method: string;
  methodLabel: string;
  amount: number;
  orderNo: number;
  where: string;
  minutes: number;
  orderId: string;
}) {
  const [ref, setRef] = useState("");
  const [err, setErr] = useState<string>();
  const [busy, start] = useTransition();
  const act = (ok: boolean) =>
    start(async () => {
      const r = await confirmPending(p.paymentId, ok, ref);
      setErr(r?.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-teh/40 bg-teh-soft/60 p-3">
      <div className="min-w-40 flex-1">
        <Link href={`/app/orders/${p.orderId}`} className="font-semibold hover:underline">
          #{p.orderNo} {p.where}
        </Link>
        <p className="text-sm text-ink-soft">
          {p.methodLabel} · {p.minutes} min ago
        </p>
      </div>
      <p className="num text-xl font-bold">{rm(p.amount)}</p>
      {p.method === "duitnow_qr" ? (
        <Input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Bank ref (from your bank app)"
          className="w-full sm:w-56"
          aria-label="Bank reference"
        />
      ) : null}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => act(true)}>
          {p.method === "online" ? "Mark paid" : "Received"}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => act(false)}>
          Not received
        </Button>
      </div>
      {err ? <p className="w-full text-sm font-semibold text-chili">{err}</p> : null}
    </div>
  );
}
