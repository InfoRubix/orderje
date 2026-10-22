"use client";

import { keep } from "@/lib/keep-form";
import { useActionState, useState, useTransition } from "react";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, FormError, Input } from "@/components/ui";
import { useT } from "@/components/i18n";
import { addTables, updateTable } from "../actions";

export function PrintButton() {
  const t = useT();
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer className="size-4" /> {t("Print QR codes")}
    </Button>
  );
}

export function AddTables() {
  const t = useT();
  const [state, action, pending] = useActionState(addTables, undefined);
  return (
    <form onSubmit={keep(action)} className="mb-6 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">{t("Add")}</span>
      <Input name="count" type="number" min={1} max={100} defaultValue={1} className="w-20" aria-label={t("How many")} />
      <Input name="prefix" defaultValue="Meja" className="w-32" aria-label={t("Name prefix")} />
      <Button variant="secondary" disabled={pending}>
        {t("Add tables")}
      </Button>
      <FormError message={state?.error} />
    </form>
  );
}

export function TableCard({
  id,
  shop,
  label,
  url,
  svg,
  active = true,
  caption,
  color,
}: {
  id?: string;
  color: string;
  shop: string;
  label: string;
  url: string;
  svg: string;
  active?: boolean;
  caption: string;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label);
  const [err, setErr] = useState<string>();
  const [busy, start] = useTransition();
  const run = (patch: Parameters<typeof updateTable>[1]) =>
    start(async () => {
      const r = await updateTable(id!, patch);
      setErr(r?.error);
      if (!r?.error) setEditing(false);
    });

  return (
    <div
      className={cn("break-inside-avoid rounded-xl border border-t-4 border-line bg-surface p-4 text-center", !active && "opacity-50 print:hidden")}
      style={{ borderTopColor: color }}
    >
      <p className="text-xs text-ink-soft">{shop}</p>
      <p className="font-display text-xl font-bold">{label}</p>
      <div className="mx-auto my-2 w-full max-w-44 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-sm font-semibold">{caption}</p>
      <div className="no-print mt-3 space-y-2 border-t border-line pt-3 text-left">
        <a href={url} target="_blank" rel="noreferrer" className="block text-sm font-bold text-ink underline decoration-tag decoration-[3px] underline-offset-4">
          {t("Open as customer")}
        </a>
        {id ? (
          editing ? (
            <div className="flex gap-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" aria-label={t("Table name")} />
              <Button size="sm" disabled={busy} onClick={() => run({ label: name })}>
                {t("Save")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                {t("Rename")}
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run({ active: !active })}>
                {active ? t("Disable") : t("Enable")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                title={t("Old printed QR stops working")}
                onClick={() => confirm(t("Make a new QR for this table? The old sticker will stop working.")) && run({ regenerate: true })}
              >
                {t("New QR")}
              </Button>
            </div>
          )
        ) : null}
        <FormError message={err} />
      </div>
    </div>
  );
}
