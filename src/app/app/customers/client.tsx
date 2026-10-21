"use client";

import { keep } from "@/lib/keep-form";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { saveCustomer, settleCredit } from "../actions";

type C = {
  id: string;
  type: "member" | "staff" | "corporate";
  name: string;
  phone: string | null;
  company: string | null;
  creditLimitRm: string;
  active: boolean;
};

export function CustomerForm({ type, c, onDone }: { type: C["type"]; c?: C; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveCustomer, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (!c) ref.current?.reset();
      onDone?.();
    }
  }, [state, c, onDone]);
  return (
    <form ref={ref} onSubmit={keep(action)} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="type" value={type} />
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <Field label={type === "corporate" ? "Contact person" : "Name"}>
        <Input name="name" defaultValue={c?.name} required />
      </Field>
      <Field label="Phone">
        <Input name="phone" defaultValue={c?.phone ?? ""} inputMode="tel" />
      </Field>
      {type === "corporate" ? (
        <>
          <Field label="Company">
            <Input name="company" defaultValue={c?.company ?? ""} required />
          </Field>
          <Field label="Credit limit (RM)" hint="0 means no limit">
            <Input name="creditLimit" defaultValue={c?.creditLimitRm ?? "500.00"} inputMode="decimal" className="num" />
          </Field>
        </>
      ) : null}
      {c ? (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="hidden" name="active" value="false" />
          <input type="checkbox" name="active" defaultChecked={c.active} className="size-4 accent-pandan" />
          Active
        </label>
      ) : null}
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button disabled={pending}>{c ? "Save" : "Add"}</Button>
        {state?.message && !c ? <span className="text-sm font-semibold text-pandan">{state.message}</span> : null}
        <FormError message={state?.error} />
      </div>
    </form>
  );
}

export function CustomerRow({ c, owing, owingLabel }: { c: C; owing?: number; owingLabel?: string }) {
  const [mode, setMode] = useState<"view" | "edit" | "settle">("view");
  return (
    <div className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {c.company ? `${c.company} · ` : ""}
            {c.name} {!c.active ? <span className="text-sm font-normal text-mute">(inactive)</span> : null}
          </p>
          {c.phone ? <p className="text-sm text-ink-soft">{c.phone}</p> : null}
        </div>
        {owingLabel !== undefined ? (
          <div className="text-right">
            <p className="text-xs text-ink-soft">Owing</p>
            <p className={`num font-bold ${owing ? "text-chili" : ""}`}>{owingLabel}</p>
          </div>
        ) : null}
        <div className="flex gap-1">
          {owing ? (
            <Button size="sm" variant="secondary" onClick={() => setMode(mode === "settle" ? "view" : "settle")}>
              Record payment
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => setMode(mode === "edit" ? "view" : "edit")}>
            {mode === "edit" ? "Close" : "Edit"}
          </Button>
        </div>
      </div>
      {mode === "edit" ? (
        <div className="mt-3 rounded-lg bg-paper p-4">
          <CustomerForm type={c.type} c={c} onDone={() => setMode("view")} />
        </div>
      ) : null}
      {mode === "settle" ? <SettleForm customerId={c.id} owing={owing ?? 0} onDone={() => setMode("view")} /> : null}
    </div>
  );
}

function SettleForm({ customerId, owing, onDone }: { customerId: string; owing: number; onDone: () => void }) {
  const [state, action, pending] = useActionState(settleCredit, undefined);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  return (
    <form onSubmit={keep(action)} className="mt-3 grid gap-3 rounded-lg bg-paper p-4 sm:grid-cols-4">
      <input type="hidden" name="customerId" value={customerId} />
      <Field label="Amount (RM)">
        <Input name="amount" defaultValue={(owing / 100).toFixed(2)} inputMode="decimal" className="num" />
      </Field>
      <Field label="Paid by">
        <Select name="method" defaultValue="duitnow_qr">
          <option value="duitnow_qr">Bank transfer / DuitNow QR</option>
          <option value="cash">Cash</option>
        </Select>
      </Field>
      <Field label="Reference">
        <Input name="reference" placeholder="Invoice / bank ref" />
      </Field>
      <div className="flex items-end">
        <Button disabled={pending} className="w-full">
          Record
        </Button>
      </div>
      <div className="sm:col-span-4">
        <FormError message={state?.error} />
      </div>
    </form>
  );
}
