"use client";

import { keep } from "@/lib/keep-form";
import { useActionState } from "react";
import { Button, Card, Field, FormError, Input } from "@/components/ui";
import { saveSettings } from "../actions";

type T = {
  email: string;
  sstRate: string;
  serviceChargeRate: string;
  memberDiscountRate: string;
  staffDiscountRate: string;
};

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {sub ? <p className="mb-4 text-sm text-ink-soft">{sub}</p> : <div className="mb-4" />}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export function SettingsForm({ t }: { t: T }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form onSubmit={keep(action)} className="space-y-5">
      <Section title="Contact" sub="Where Rubix reaches you about your account.">
        <Field label="Email" className="sm:col-span-2">
          <Input name="email" type="email" defaultValue={t.email} />
        </Field>
      </Section>

      <Section title="Tax, service & discounts" sub="Service charge applies to dine-in only. Discounts apply when you set the customer type at payment.">
        <Field label="SST (%)" hint="0 if not registered">
          <Input name="sstRate" defaultValue={t.sstRate} inputMode="decimal" className="num" />
        </Field>
        <Field label="Service charge (%)">
          <Input name="serviceChargeRate" defaultValue={t.serviceChargeRate} inputMode="decimal" className="num" />
        </Field>
        <Field label="Member discount (%)">
          <Input name="memberDiscountRate" defaultValue={t.memberDiscountRate} inputMode="decimal" className="num" />
        </Field>
        <Field label="Staff discount (%)">
          <Input name="staffDiscountRate" defaultValue={t.staffDiscountRate} inputMode="decimal" className="num" />
        </Field>
      </Section>

      <div className="sticky bottom-20 flex items-center gap-3 rounded-xl border-2 border-edge bg-surface p-3 md:bottom-4">
        <Button size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {state?.message ? <span className="text-sm font-semibold text-pandan">{state.message}</span> : null}
        <FormError message={state?.error} />
      </div>
    </form>
  );
}
