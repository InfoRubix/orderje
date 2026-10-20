"use client";

import { useActionState } from "react";
import { Button, Card, Field, FormError, Input } from "@/components/ui";
import { saveSettings } from "../actions";

type T = {
  name: string;
  address: string;
  phone: string;
  email: string;
  receiptFooter: string;
  sstRate: string;
  serviceChargeRate: string;
  memberDiscountRate: string;
  staffDiscountRate: string;
  allowQrCounterPay: boolean;
  duitnowQrUrl: string | null;
  toyyibpayCategory: string;
  hasToyyibpaySecret: boolean;
  toyyibpaySandbox: boolean;
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

export function SettingsForm({ t, callbackUrl }: { t: T; callbackUrl: string }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="space-y-5">
      <Section title="Kedai details" sub="Printed on receipts.">
        <Field label="Kedai name" className="sm:col-span-2">
          <Input name="name" defaultValue={t.name} required />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input name="address" defaultValue={t.address} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={t.phone} inputMode="tel" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={t.email} />
        </Field>
        <Field label="Receipt footer" className="sm:col-span-2">
          <Input name="receiptFooter" defaultValue={t.receiptFooter} placeholder="Terima kasih, datang lagi!" />
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

      <Section title="DuitNow QR" sub="Your static DuitNow QR. Customers can scan it from their order page, and the counter confirms against your bank app.">
        <div className="sm:col-span-2 flex flex-wrap items-start gap-4">
          {t.duitnowQrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.duitnowQrUrl} alt="Current DuitNow QR" className="w-32 rounded-lg border border-line" />
          ) : (
            <p className="rounded-lg bg-paper p-3 text-sm text-ink-soft">No QR uploaded yet.</p>
          )}
          <div className="space-y-2">
            <Field label="Upload QR image" hint="PNG or JPG, under 400 KB">
              <Input name="duitnowQr" type="file" accept="image/png,image/jpeg,image/webp" className="h-auto py-2" />
            </Field>
            {t.duitnowQrUrl ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="removeQr" className="size-4 accent-chili" /> Remove current QR
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="allowQrCounterPay" defaultChecked={t.allowQrCounterPay} className="size-4 accent-pandan" />
              Show the QR on customers&apos; order page
            </label>
          </div>
        </div>
      </Section>

      <Section
        title="Online payment (ToyyibPay FPX)"
        sub="Money settles straight into your own ToyyibPay account. Leave blank to accept counter payments only."
      >
        <Field label="User secret key" hint={t.hasToyyibpaySecret ? "Saved. Leave blank to keep it." : "From ToyyibPay → Settings"}>
          <Input name="toyyibpaySecret" type="password" autoComplete="off" placeholder={t.hasToyyibpaySecret ? "••••••••" : ""} />
        </Field>
        <Field label="Category code">
          <Input name="toyyibpayCategory" defaultValue={t.toyyibpayCategory} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="toyyibpaySandbox" defaultChecked={t.toyyibpaySandbox} className="size-4 accent-pandan" />
          Sandbox mode (testing, no real money)
        </label>
        {t.hasToyyibpaySecret ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="clearToyyibpay" className="size-4 accent-chili" /> Disconnect ToyyibPay
          </label>
        ) : null}
        <p className="text-xs text-mute sm:col-span-2">Callback URL (set automatically): {callbackUrl}</p>
      </Section>

      <div className="sticky bottom-20 flex items-center gap-3 rounded-xl border border-line bg-surface p-3 md:bottom-4">
        <Button size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {state?.message ? <span className="text-sm font-semibold text-pandan">{state.message}</span> : null}
        <FormError message={state?.error} />
      </div>
    </form>
  );
}
