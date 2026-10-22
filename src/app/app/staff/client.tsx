"use client";

import { keep } from "@/lib/keep-form";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Badge, Button, Field, FormError, Input, Select } from "@/components/ui";
import { saveStaff, setStaffActive } from "../actions";

type U = { id: string; name: string; email: string; role: "owner" | "cashier" | "kitchen"; active: boolean };

export function StaffForm({ u, onDone }: { u?: U; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveStaff, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      if (!u) ref.current?.reset();
      onDone?.();
    }
  }, [state, u, onDone]);
  return (
    <form ref={ref} onSubmit={keep(action)} className="grid gap-3 sm:grid-cols-2">
      {u ? <input type="hidden" name="id" value={u.id} /> : null}
      <Field label="Name">
        <Input name="name" defaultValue={u?.name} required />
      </Field>
      <Field label="Email (login)">
        <Input name="email" type="email" defaultValue={u?.email} required />
      </Field>
      <Field label="Role">
        <Select name="role" defaultValue={u?.role ?? "cashier"}>
          <option value="cashier">Cashier</option>
          <option value="kitchen">Kitchen</option>
          <option value="owner">Owner (full access)</option>
        </Select>
      </Field>
      <Field label={u ? "New password" : "Password"} hint={u ? "Leave blank to keep the current one" : "At least 8 characters"}>
        <Input name="password" type="password" autoComplete="new-password" required={!u} minLength={u ? undefined : 8} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button disabled={pending}>{u ? "Save" : "Add staff"}</Button>
        {state?.message && !u ? <span className="text-sm font-semibold text-pandan">{state.message}</span> : null}
        <FormError message={state?.error} />
      </div>
    </form>
  );
}

export function StaffRow({ u, isMe }: { u: U; isMe: boolean }) {
  const [edit, setEdit] = useState(false);
  const [err, setErr] = useState<string>();
  const [busy, start] = useTransition();
  return (
    <div className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {u.name} {isMe ? <span className="text-sm font-normal text-mute">(you)</span> : null}
          </p>
          <p className="text-sm text-ink-soft">{u.email}</p>
        </div>
        <Badge tone={u.role === "owner" ? "dark" : "neutral"}>
          {u.role}
        </Badge>
        {!u.active ? <Badge tone="red">Inactive</Badge> : null}
        <Button size="sm" variant="ghost" onClick={() => setEdit(!edit)}>
          {edit ? "Close" : "Edit"}
        </Button>
        {!isMe ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await setStaffActive(u.id, !u.active);
                setErr(r?.error);
              })
            }
          >
            {u.active ? "Deactivate" : "Reactivate"}
          </Button>
        ) : null}
      </div>
      <FormError message={err} />
      {edit ? (
        <div className="mt-3 rounded-lg bg-paper p-4">
          <StaffForm u={u} onDone={() => setEdit(false)} />
        </div>
      ) : null}
    </div>
  );
}
