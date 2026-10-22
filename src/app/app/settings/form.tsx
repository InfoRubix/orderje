"use client";

import { keep } from "@/lib/keep-form";
import { useActionState } from "react";
import { Button, Card, Field, FormError, Input, Select } from "@/components/ui";
import { useT } from "@/components/i18n";
import { LANGS, type Lang } from "@/lib/i18n";
import { saveSettings } from "../actions";

type Values = {
  language: Lang;
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

export function SettingsForm({ v }: { v: Values }) {
  const t = useT();
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form onSubmit={keep(action)} className="space-y-5">
      <Section title={t("Language")} sub={t("For staff screens and the customer menu, order page and receipt.")}>
        <Field label={t("Language")} className="sm:col-span-2">
          <Select name="language" defaultValue={v.language} aria-label="Language / Bahasa">
            {(Object.keys(LANGS) as Lang[]).map((l) => (
              <option key={l} value={l}>
                {LANGS[l]}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section title={t("Contact")} sub={t("Where Rubix reaches you about your account.")}>
        <Field label={t("Email")} className="sm:col-span-2">
          <Input name="email" type="email" defaultValue={v.email} />
        </Field>
      </Section>

      <Section
        title={t("Tax, service & discounts")}
        sub={t("Service charge applies to dine-in only. Discounts apply when you set the customer type at payment.")}
      >
        <Field label="SST (%)" hint={t("0 if not registered")}>
          <Input name="sstRate" defaultValue={v.sstRate} inputMode="decimal" className="num" />
        </Field>
        <Field label={t("Service charge (%)")}>
          <Input name="serviceChargeRate" defaultValue={v.serviceChargeRate} inputMode="decimal" className="num" />
        </Field>
        <Field label={t("Member discount (%)")}>
          <Input name="memberDiscountRate" defaultValue={v.memberDiscountRate} inputMode="decimal" className="num" />
        </Field>
        <Field label={t("Staff discount (%)")}>
          <Input name="staffDiscountRate" defaultValue={v.staffDiscountRate} inputMode="decimal" className="num" />
        </Field>
      </Section>

      <div className="sticky bottom-20 flex items-center gap-3 rounded-xl border-2 border-edge bg-surface p-3 md:bottom-4">
        <Button size="lg" disabled={pending}>
          {pending ? t("Saving…") : t("Save settings")}
        </Button>
        {state?.message ? <span className="text-sm font-semibold text-pandan">{state.message}</span> : null}
        <FormError message={state?.error} />
      </div>
    </form>
  );
}
