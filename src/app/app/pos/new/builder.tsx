"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, X } from "lucide-react";
import type { Menu, MenuItemFull } from "@/lib/orders";
import { computeTotals, ORDER_TYPE_LABEL } from "@/lib/pricing";
import { rm } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button, FormError, Input, Select } from "@/components/ui";
import { createCounterOrder } from "../../actions";

type Line = { key: string; item: MenuItemFull; qty: number; optionIds: string[]; note: string };
type OrderType = "dine_in" | "takeaway" | "delivery";

const unit = (item: MenuItemFull, ids: string[]) =>
  item.price + ids.reduce((s, id) => s + (item.groups.flatMap((g) => g.options).find((o) => o.id === id)?.price ?? 0), 0);
const optNames = (item: MenuItemFull, ids: string[]) =>
  ids.map((id) => item.groups.flatMap((g) => g.options).find((o) => o.id === id)?.name).filter(Boolean).join(", ");

export function CounterOrder({
  menu,
  tables,
  defaultTable,
  rates,
}: {
  menu: Menu;
  tables: { id: string; label: string }[];
  defaultTable?: string;
  rates: Parameters<typeof computeTotals>[0];
}) {
  const router = useRouter();
  const [cat, setCat] = useState(menu[0]?.id);
  const [lines, setLines] = useState<Line[]>([]);
  const [picking, setPicking] = useState<MenuItemFull | null>(null);
  const [orderType, setOrderType] = useState<OrderType>(defaultTable ? "dine_in" : "takeaway");
  const [tableId, setTableId] = useState(defaultTable ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [busy, start] = useTransition();

  const subtotal = lines.reduce((s, l) => s + unit(l.item, l.optionIds) * l.qty, 0);
  const totals = computeTotals(rates, subtotal, "walk_in", orderType);
  const items = menu.find((c) => c.id === cat)?.items ?? [];

  function add(item: MenuItemFull, optionIds: string[] = [], qty = 1, lineNote = "") {
    setLines((cur) => {
      const same = cur.find((l) => l.item.id === item.id && l.optionIds.join() === optionIds.join() && l.note === lineNote);
      if (same) return cur.map((l) => (l === same ? { ...l, qty: Math.min(99, l.qty + qty) } : l));
      return [...cur, { key: crypto.randomUUID(), item, qty, optionIds, note: lineNote }];
    });
  }

  function submit() {
    start(async () => {
      setError(undefined);
      const r = await createCounterOrder({
        orderType,
        tableId: orderType === "dine_in" ? tableId || null : null,
        customerName: name || undefined,
        customerPhone: phone || undefined,
        note: note || undefined,
        lines: lines.map((l) => ({ menuItemId: l.item.id, qty: l.qty, optionIds: l.optionIds, note: l.note || undefined })),
      });
      if (r?.error) setError(r.error);
      else if (r?.id) router.push(`/app/orders/${r.id}`);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section>
        <h1 className="mb-4 font-display text-2xl font-bold md:text-3xl">New order</h1>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {menu.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={cn(
                "shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold",
                cat === c.id ? "border-edge bg-cta text-on-cta" : "border-line bg-surface text-ink-soft",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        {menu.length === 0 ? <p className="text-ink-soft">No menu items yet. Add some under Menu.</p> : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => (item.groups.length ? setPicking(item) : add(item))}
              className="flex min-h-24 flex-col justify-between rounded-xl border-2 border-edge bg-surface p-3 text-left hover:bg-tag-soft active:bg-pandan-soft"
            >
              <span className="font-semibold leading-snug">{item.name}</span>
              <span className="num mt-2 text-sm font-semibold text-pandan-dark">
                {rm(item.price)}
                {item.groups.length ? <span className="ml-1 font-normal text-mute">+ options</span> : null}
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="h-fit rounded-xl border-2 border-edge bg-surface lg:sticky lg:top-6">
        <div className="border-b border-line p-4">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-paper p-1">
            {(["dine_in", "takeaway", "delivery"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={cn(
                  "rounded-md py-1.5 text-sm font-semibold",
                  orderType === t ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
                )}
                aria-pressed={orderType === t}
              >
                {ORDER_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {orderType === "dine_in" ? (
              <Select value={tableId} onChange={(e) => setTableId(e.target.value)} aria-label="Table">
                <option value="">Pick a table…</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            ) : null}
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={orderType === "delivery" ? "Customer / rider (e.g. Grab #123)" : "Customer name (optional)"}
            />
            {orderType !== "dine_in" ? (
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" inputMode="tel" />
            ) : null}
          </div>
        </div>

        <ul className="max-h-[40vh] divide-y divide-line overflow-y-auto">
          {lines.length === 0 ? <li className="p-6 text-center text-sm text-mute">Tap items to add them.</li> : null}
          {lines.map((l) => (
            <li key={l.key} className="flex items-start gap-2 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{l.item.name}</p>
                {l.optionIds.length ? <p className="text-xs text-ink-soft">{optNames(l.item, l.optionIds)}</p> : null}
                {l.note ? <p className="text-xs italic text-ink-soft">“{l.note}”</p> : null}
                <p className="num text-sm">{rm(unit(l.item, l.optionIds) * l.qty)}</p>
              </div>
              <div className="flex items-center">
                <button
                  className="grid size-8 place-items-center rounded text-ink-soft hover:bg-paper"
                  aria-label="Less"
                  onClick={() => setLines((c) => c.flatMap((x) => (x.key !== l.key ? [x] : x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : [])))}
                >
                  {l.qty > 1 ? <Minus className="size-4" /> : <Trash2 className="size-4" />}
                </button>
                <span className="num w-6 text-center font-bold">{l.qty}</span>
                <button
                  className="grid size-8 place-items-center rounded text-ink-soft hover:bg-paper"
                  aria-label="More"
                  onClick={() => setLines((c) => c.map((x) => (x.key === l.key ? { ...x, qty: Math.min(99, x.qty + 1) } : x)))}
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-3 border-t border-line p-4">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Order note" />
          <dl className="num space-y-1 text-sm">
            <div className="flex justify-between text-ink-soft">
              <dt>Subtotal</dt>
              <dd>{rm(totals.subtotal)}</dd>
            </div>
            {totals.serviceCharge ? (
              <div className="flex justify-between text-ink-soft">
                <dt>Service charge</dt>
                <dd>{rm(totals.serviceCharge)}</dd>
              </div>
            ) : null}
            {totals.sst ? (
              <div className="flex justify-between text-ink-soft">
                <dt>SST</dt>
                <dd>{rm(totals.sst)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-lg font-bold">
              <dt>Total</dt>
              <dd>{rm(totals.total)}</dd>
            </div>
          </dl>
          <p className="text-xs text-mute">Member, staff or corporate pricing is applied on the payment screen.</p>
          <FormError message={error} />
          <Button size="xl" className="w-full" disabled={busy || lines.length === 0} onClick={submit}>
            {busy ? "Sending…" : "Send to kitchen & bill"}
          </Button>
        </div>
      </aside>

      {picking ? (
        <OptionsDialog
          item={picking}
          onClose={() => setPicking(null)}
          onAdd={(ids, qty, n) => {
            add(picking, ids, qty, n);
            setPicking(null);
          }}
        />
      ) : null}
    </div>
  );
}

function OptionsDialog({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItemFull;
  onClose: () => void;
  onAdd: (ids: string[], qty: number, note: string) => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const missing = item.groups.find((g) => g.required && !g.options.some((o) => ids.includes(o.id)));
  const toggle = (gid: string, oid: string) => {
    const g = item.groups.find((x) => x.id === gid)!;
    const inG = g.options.map((o) => o.id);
    setIds((cur) => {
      if (cur.includes(oid)) return cur.filter((x) => x !== oid);
      if (g.maxSelect === 1) return [...cur.filter((x) => !inG.includes(x)), oid];
      if (cur.filter((x) => inG.includes(x)).length >= g.maxSelect) return cur;
      return [...cur, oid];
    });
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal aria-label={item.name}>
      <button className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-xl font-bold">{item.name}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-ink-soft">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4">
          {item.groups.map((g) => (
            <div key={g.id}>
              <p className="mb-2 text-sm font-semibold">
                {g.name} <span className="font-normal text-mute">{g.required ? "(required)" : "(optional)"}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => toggle(g.id, o.id)}
                    aria-pressed={ids.includes(o.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-semibold",
                      ids.includes(o.id) ? "border-pandan bg-pandan-soft text-pandan-dark" : "border-line",
                    )}
                  >
                    {o.name}
                    {o.price ? <span className="num ml-1 font-normal">+{(o.price / 100).toFixed(2)}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kitchen note" />
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-md border-2 border-edge">
              <button className="grid size-10 place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Less">
                <Minus className="size-4" />
              </button>
              <span className="num w-6 text-center font-bold">{qty}</span>
              <button className="grid size-10 place-items-center" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label="More">
                <Plus className="size-4" />
              </button>
            </div>
            <Button size="lg" className="flex-1" disabled={!!missing} onClick={() => onAdd(ids, qty, note.trim())}>
              {missing ? `Choose ${missing.name}` : `Add · ${rm(unit(item, ids) * qty)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
