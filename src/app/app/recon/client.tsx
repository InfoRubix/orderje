"use client";

import { keep } from "@/lib/keep-form";
import { useActionState, useState, useTransition } from "react";
import { rm, toSen } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button, Card, Field, FormError, Input, Textarea } from "@/components/ui";
import { useT } from "@/components/i18n";
import { closeDay, reopenDay } from "../actions";

export function CloseDayForm({ date, expected }: { date: string; expected: { cash: number; qr: number } }) {
  const t = useT();
  const [state, action, pending] = useActionState(closeDay, undefined);
  const [float, setFloat] = useState("0");
  const [cash, setCash] = useState("");
  const [qr, setQr] = useState("");
  const v = (s: string) => {
    const n = toSen(s || "0");
    return Number.isFinite(n) ? n : 0;
  };
  const diffs = {
    cash: cash === "" ? null : v(cash) - v(float) - expected.cash,
    qr: qr === "" ? null : v(qr) - expected.qr,
  };
  const Diff = ({ d }: { d: number | null }) =>
    d === null ? null : (
      <span className={cn("num text-sm font-semibold", d < 0 ? "text-chili" : d > 0 ? "text-teh" : "text-pandan")}>
        {d === 0 ? t("Matches") : d < 0 ? t("Short {amount}", { amount: rm(-d) }) : t("Over {amount}", { amount: rm(d) })}
      </span>
    );

  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold">{t("Close {date}", { date })}</h2>
      <p className="mb-4 text-sm text-ink-soft">{t("Count the drawer and check your bank app, then enter what you see.")}</p>
      <form onSubmit={keep(action)} className="space-y-4">
        <input type="hidden" name="date" value={date} />
        <Field label={t("Opening float (RM)")} hint={t("Cash in the drawer before the first sale")}>
          <Input name="openingFloat" value={float} onChange={(e) => setFloat(e.target.value)} inputMode="decimal" className="num" />
        </Field>
        <Field label={t("Cash counted in drawer (RM)")} hint={t("System expects {amount} + float", { amount: rm(expected.cash) })}>
          <Input name="countedCash" value={cash} onChange={(e) => setCash(e.target.value)} inputMode="decimal" className="num" required />
        </Field>
        <Diff d={diffs.cash} />
        <Field label={t("DuitNow QR received in bank (RM)")} hint={t("System expects {amount}", { amount: rm(expected.qr) })}>
          <Input name="bankQr" value={qr} onChange={(e) => setQr(e.target.value)} inputMode="decimal" className="num" required />
        </Field>
        <Diff d={diffs.qr} />
        <Field label={t("Notes")} hint={t("Explain any difference, e.g. RM5 given as change by mistake")}>
          <Textarea name="notes" maxLength={500} />
        </Field>
        <FormError message={state?.error} />
        {state?.message ? <p className="text-sm font-semibold text-pandan">{state.message}</p> : null}
        <Button size="lg" className="w-full" disabled={pending}>
          {pending ? t("Closing…") : t("Close {date}", { date })}
        </Button>
      </form>
    </Card>
  );
}

export function ReopenButton({ date }: { date: string }) {
  const t = useT();
  const [busy, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={() => confirm(t("Reopen {date}? You'll need to close it again.", { date })) && start(() => reopenDay(date).then(() => {}))}
    >
      {t("Reopen day")}
    </Button>
  );
}
