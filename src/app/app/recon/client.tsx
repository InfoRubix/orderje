"use client";

import { useActionState, useState, useTransition } from "react";
import { rm, toSen } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button, Card, Field, FormError, Input, Textarea } from "@/components/ui";
import { closeDay, reopenDay } from "../actions";

export function CloseDayForm({ date, expected }: { date: string; expected: { cash: number; qr: number; online: number } }) {
  const [state, action, pending] = useActionState(closeDay, undefined);
  const [float, setFloat] = useState("0");
  const [cash, setCash] = useState("");
  const [qr, setQr] = useState("");
  const [online, setOnline] = useState("");
  const v = (s: string) => {
    const n = toSen(s || "0");
    return Number.isFinite(n) ? n : 0;
  };
  const diffs = {
    cash: cash === "" ? null : v(cash) - v(float) - expected.cash,
    qr: qr === "" ? null : v(qr) - expected.qr,
    online: online === "" ? null : v(online) - expected.online,
  };
  const Diff = ({ d }: { d: number | null }) =>
    d === null ? null : (
      <span className={cn("num text-sm font-semibold", d < 0 ? "text-chili" : d > 0 ? "text-teh" : "text-pandan")}>
        {d === 0 ? "Matches" : d < 0 ? `Short ${rm(-d)}` : `Over ${rm(d)}`}
      </span>
    );

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold">Close {date}</h2>
      <p className="mb-4 text-sm text-ink-soft">Count the drawer and check your bank and ToyyibPay, then enter what you see.</p>
      <form action={action} className="space-y-4">
        <input type="hidden" name="date" value={date} />
        <Field label="Opening float (RM)" hint="Cash in the drawer before the first sale">
          <Input name="openingFloat" value={float} onChange={(e) => setFloat(e.target.value)} inputMode="decimal" className="num" />
        </Field>
        <Field label="Cash counted in drawer (RM)" hint={`System expects ${rm(expected.cash)} + float`}>
          <Input name="countedCash" value={cash} onChange={(e) => setCash(e.target.value)} inputMode="decimal" className="num" required />
        </Field>
        <Diff d={diffs.cash} />
        <Field label="DuitNow QR received in bank (RM)" hint={`System expects ${rm(expected.qr)}`}>
          <Input name="bankQr" value={qr} onChange={(e) => setQr(e.target.value)} inputMode="decimal" className="num" required />
        </Field>
        <Diff d={diffs.qr} />
        <Field label="Online in ToyyibPay (RM)" hint={`System expects ${rm(expected.online)}`}>
          <Input name="gatewayOnline" value={online} onChange={(e) => setOnline(e.target.value)} inputMode="decimal" className="num" required />
        </Field>
        <Diff d={diffs.online} />
        <Field label="Notes" hint="Explain any difference, e.g. RM5 given as change by mistake">
          <Textarea name="notes" maxLength={500} />
        </Field>
        <FormError message={state?.error} />
        {state?.message ? <p className="text-sm font-semibold text-pandan">{state.message}</p> : null}
        <Button size="lg" className="w-full" disabled={pending}>
          {pending ? "Closing…" : `Close ${date}`}
        </Button>
      </form>
    </Card>
  );
}

export function ReopenButton({ date }: { date: string }) {
  const [busy, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={() => confirm(`Reopen ${date}? You'll need to close it again.`) && start(() => reopenDay(date).then(() => {}))}
    >
      Reopen day
    </Button>
  );
}
