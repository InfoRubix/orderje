"use client";

import { useState, useTransition } from "react";
import { CreditCard, QrCode, Store } from "lucide-react";
import { rm } from "@/lib/money";
import { Button, FormError } from "@/components/ui";
import { declareQr, payOnline } from "../actions";

export function PayOptions({
  token,
  total,
  pending,
  pendingMethod,
  online,
  qrUrl,
}: {
  token: string;
  total: number;
  pending: boolean;
  pendingMethod?: string;
  online: boolean;
  qrUrl: string | null;
}) {
  const [showQr, setShowQr] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();

  if (pending) {
    return (
      <div className="rounded-xl border border-teh/30 bg-teh-soft p-4">
        <p className="font-semibold text-teh">
          {pendingMethod === "online" ? "Waiting for the bank to confirm your payment…" : "Waiting for the counter to confirm your QR payment…"}
        </p>
        <p className="mt-1 text-sm text-ink-soft">This usually takes a minute. No need to pay again.</p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-bold">Pay {rm(total)}</h2>
      <FormError message={error} />
      {online ? (
        <Button
          size="lg"
          className="w-full"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const r = await payOnline(token);
              if (r?.error) setError(r.error);
            })
          }
        >
          <CreditCard className="size-5" aria-hidden /> {busy ? "Opening bank page…" : "Pay online (FPX)"}
        </Button>
      ) : null}
      {qrUrl ? (
        showQr ? (
          <div className="rounded-xl border border-line bg-surface p-4 text-center">
            <p className="text-sm text-ink-soft">Scan with your banking app and pay exactly</p>
            <p className="num font-display text-3xl font-bold">{rm(total)}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="DuitNow QR code" className="mx-auto my-3 w-64 max-w-full rounded-lg" />
            <Button
              size="lg"
              variant="dark"
              className="w-full"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const r = await declareQr(token);
                  if (r?.error) setError(r.error);
                })
              }
            >
              I&apos;ve paid
            </Button>
          </div>
        ) : (
          <Button size="lg" variant="secondary" className="w-full" onClick={() => setShowQr(true)}>
            <QrCode className="size-5" aria-hidden /> Pay with DuitNow QR
          </Button>
        )
      ) : null}
      <p className="flex items-center justify-center gap-2 text-sm text-ink-soft">
        <Store className="size-4" aria-hidden /> Or pay at the counter with cash or QR.
      </p>
    </section>
  );
}
