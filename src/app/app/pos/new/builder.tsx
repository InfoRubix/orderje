"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CloudOff, Minus, Plus, Trash2, X } from "lucide-react";
import type { Menu, MenuItemFull } from "@/lib/orders";
import { computeTotals, ORDER_TYPE_LABEL } from "@/lib/pricing";
import { cashRound, rm, toSen } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button, FormError, Input, Select } from "@/components/ui";
import { useT } from "@/components/i18n";
import { enqueue, useOnline } from "@/lib/offline-queue";
import { createCounterOrder } from "../../actions";

/** price: sen typed by the cashier, only for open-price items (nasi campur). */
type Line = { key: string; item: MenuItemFull; qty: number; optionIds: string[]; note: string; price?: number };
type OrderType = "dine_in" | "takeaway" | "delivery";
type Pay = { method: "cash" | "duitnow_qr"; tendered?: number; reference?: string };
/** What the last pay-now left on screen, so the cashier can read out the change and move on. */
type Done = { orderNo?: number; id?: string; publicToken?: string; change: number | null; payError?: string; offline?: boolean };

const MAX_OPEN_PRICE = 100_000; // keep in step with src/lib/orders.ts
/** Amounts a kedai keys in most often for nasi campur; the item's usual price is added in front. */
const QUICK_PRICES = [500, 600, 700, 800, 1000, 1200];

const unit = (item: MenuItemFull, ids: string[], price?: number) =>
  (item.openPrice ? (price ?? 0) : item.price) + ids.reduce((s, id) => s + (item.groups.flatMap((g) => g.options).find((o) => o.id === id)?.price ?? 0), 0);
const optNames = (item: MenuItemFull, ids: string[]) =>
  ids.map((id) => item.groups.flatMap((g) => g.options).find((o) => o.id === id)?.name).filter(Boolean).join(", ");

export function CounterOrder({
  tenantId,
  menu,
  tables,
  defaultTable,
  rates,
}: {
  tenantId: string;
  menu: Menu;
  tables: { id: string; label: string }[];
  defaultTable?: string;
  rates: Parameters<typeof computeTotals>[0];
}) {
  const t = useT();
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
  const [saved, setSaved] = useState<string>();
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<Pay["method"]>("cash");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [done, setDone] = useState<Done>();
  const [busy, start] = useTransition();
  const online = useOnline();
  // One id per cart, kept through retries, so the same order can never be made twice.
  const [cartId, setCartId] = useState(() => crypto.randomUUID());

  const subtotal = lines.reduce((s, l) => s + unit(l.item, l.optionIds, l.price) * l.qty, 0);
  const totals = computeTotals(rates, subtotal, "walk_in", orderType);
  const items = menu.find((c) => c.id === cat)?.items ?? [];

  function add(item: MenuItemFull, optionIds: string[] = [], qty = 1, lineNote = "", price?: number) {
    // Next customer: clear the last one's change and notes.
    setDone(undefined);
    setSaved(undefined);
    setLines((cur) => {
      const same = cur.find(
        (l) => l.item.id === item.id && l.optionIds.join() === optionIds.join() && l.note === lineNote && l.price === price,
      );
      if (same) return cur.map((l) => (l === same ? { ...l, qty: Math.min(99, l.qty + qty) } : l));
      return [...cur, { key: crypto.randomUUID(), item, qty, optionIds, note: lineNote, price }];
    });
  }

  function clearCart() {
    setLines([]);
    setName("");
    setPhone("");
    setNote("");
    setCartId(crypto.randomUUID());
  }

  const cashDue = cashRound(totals.total);
  const tSen = tendered ? toSen(tendered) : cashDue;
  const quickCash = [...new Set([cashDue, ...[1000, 2000, 5000, 10000].map((n) => Math.ceil(cashDue / n) * n)])]
    .filter((v) => v >= cashDue)
    .slice(0, 4);
  const payBlocked =
    method === "cash" ? !Number.isFinite(tSen) || tSen < cashDue : !online || !reference.trim();

  function submit(pay?: Pay) {
    setError(undefined);
    setSaved(undefined);
    setDone(undefined);
    if (orderType === "dine_in" && !tableId) return setError(t("Pick a table for dine-in, or switch to takeaway."));
    const input = {
      orderType,
      tableId: orderType === "dine_in" ? tableId || null : null,
      customerName: name || undefined,
      customerPhone: phone || undefined,
      note: note || undefined,
      lines: lines.map((l) => ({
        menuItemId: l.item.id,
        qty: l.qty,
        optionIds: l.optionIds,
        note: l.note || undefined,
        price: l.item.openPrice ? l.price : undefined,
      })),
      pay,
    };
    const change = pay?.method === "cash" ? (pay.tendered ?? cashDue) - cashDue : null;
    const finishPay = (d: Done) => {
      clearCart();
      setPaying(false);
      setTendered("");
      setReference("");
      setDone(d);
    };

    const saveOnDevice = () => {
      if (pay && pay.method !== "cash") return setError(t("DuitNow QR needs internet. Take cash, or bill it later."));
      const label =
        (orderType === "dine_in" ? tables.find((tb) => tb.id === tableId)?.label : undefined) ?? (name || t(ORDER_TYPE_LABEL[orderType]));
      const ok = enqueue({ clientId: cartId, tenantId, queuedAt: new Date().toISOString(), input, label, total: totals.total });
      if (!ok) return setError(t("No internet, and this browser won't save the order. Write it down for now."));
      if (pay) return finishPay({ change, offline: true });
      clearCart();
      setSaved(t("Saved on this device: {label}, {total}. Tell the kitchen now; it's sent to the system when the internet is back.", { label, total: rm(totals.total) }));
    };

    if (!navigator.onLine) return saveOnDevice();
    start(async () => {
      let r: Awaited<ReturnType<typeof createCounterOrder>>;
      try {
        r = await createCounterOrder({ ...input, clientId: cartId });
      } catch {
        // The request never got an answer (Wi-Fi with no internet, Unifi down). If it did reach
        // the server, sending it again later with the same id just finds the same order.
        return saveOnDevice();
      }
      if (r?.error) setError(r.error);
      else if (pay) finishPay({ orderNo: r?.orderNo, id: r?.id, publicToken: r?.publicToken, change: r?.change ?? null, payError: r?.payError });
      else if (r?.id) router.push(`/app/orders/${r.id}`);
    });
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section>
        <h1 className="mb-4 font-display text-2xl font-bold md:text-3xl">{t("New order")}</h1>
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
        {menu.length === 0 ? <p className="text-ink-soft">{t("No menu items yet. Add some under Menu.")}</p> : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => (item.groups.length || item.openPrice ? setPicking(item) : add(item))}
              className="flex min-h-24 flex-col justify-between rounded-xl border-2 border-edge bg-surface p-3 text-left hover:bg-tag-soft active:bg-pandan-soft"
            >
              <span className="font-semibold leading-snug">{item.name}</span>
              {item.openPrice ? (
                <span className="mt-2 text-sm font-semibold text-teh">{t("Key in price")}</span>
              ) : (
                <span className="num mt-2 text-sm font-semibold text-pandan-dark">
                  {rm(item.price)}
                  {item.groups.length ? <span className="ml-1 font-normal text-mute">{t("+ options")}</span> : null}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      <aside className="h-fit rounded-xl border-2 border-edge bg-surface lg:sticky lg:top-6">
        <div className="border-b border-line p-4">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-paper p-1">
            {(["dine_in", "takeaway", "delivery"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setOrderType(k)}
                className={cn(
                  "rounded-md py-1.5 text-sm font-semibold",
                  orderType === k ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
                )}
                aria-pressed={orderType === k}
              >
                {t(ORDER_TYPE_LABEL[k])}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {orderType === "dine_in" ? (
              <Select value={tableId} onChange={(e) => setTableId(e.target.value)} aria-label={t("Table")}>
                <option value="">{t("Pick a table…")}</option>
                {tables.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    {tb.label}
                  </option>
                ))}
              </Select>
            ) : null}
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={orderType === "delivery" ? t("Customer / rider (e.g. Grab #123)") : t("Customer name (optional)")}
            />
            {orderType !== "dine_in" ? (
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("Phone (optional)")} inputMode="tel" />
            ) : null}
          </div>
        </div>

        <ul className="max-h-[40vh] divide-y divide-line overflow-y-auto">
          {lines.length === 0 ? <li className="p-6 text-center text-sm text-mute">{t("Tap items to add them.")}</li> : null}
          {lines.map((l) => (
            <li key={l.key} className="flex items-start gap-2 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-snug">{l.item.name}</p>
                {l.optionIds.length ? <p className="text-xs text-ink-soft">{optNames(l.item, l.optionIds)}</p> : null}
                {l.note ? <p className="text-xs italic text-ink-soft">“{l.note}”</p> : null}
                <p className="num text-sm">{rm(unit(l.item, l.optionIds, l.price) * l.qty)}</p>
              </div>
              <div className="flex items-center">
                <button
                  className="grid size-8 place-items-center rounded text-ink-soft hover:bg-paper"
                  aria-label={t("Less")}
                  onClick={() => setLines((c) => c.flatMap((x) => (x.key !== l.key ? [x] : x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : [])))}
                >
                  {l.qty > 1 ? <Minus className="size-4" /> : <Trash2 className="size-4" />}
                </button>
                <span className="num w-6 text-center font-bold">{l.qty}</span>
                <button
                  className="grid size-8 place-items-center rounded text-ink-soft hover:bg-paper"
                  aria-label={t("More")}
                  onClick={() => setLines((c) => c.map((x) => (x.key === l.key ? { ...x, qty: Math.min(99, x.qty + 1) } : x)))}
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-3 border-t border-line p-4">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Order note")} />
          <dl className="num space-y-1 text-sm">
            <div className="flex justify-between text-ink-soft">
              <dt>{t("Subtotal")}</dt>
              <dd>{rm(totals.subtotal)}</dd>
            </div>
            {totals.serviceCharge ? (
              <div className="flex justify-between text-ink-soft">
                <dt>{t("Service charge")}</dt>
                <dd>{rm(totals.serviceCharge)}</dd>
              </div>
            ) : null}
            {totals.sst ? (
              <div className="flex justify-between text-ink-soft">
                <dt>{t("SST")}</dt>
                <dd>{rm(totals.sst)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-lg font-bold">
              <dt>{t("Total")}</dt>
              <dd>{rm(totals.total)}</dd>
            </div>
          </dl>
          <p className="text-xs text-mute">
            {t("Pay now is walk-in pricing. For member, staff or corporate, use Send to kitchen & bill.")}
          </p>
          <FormError message={error} />
          {done ? <DoneNote done={done} /> : null}
          {saved ? (
            <p role="status" className="rounded-md border-2 border-teh bg-teh-soft px-3 py-2 text-sm font-semibold text-teh">
              {saved}
            </p>
          ) : null}
          {paying ? (
            <div className="space-y-3 rounded-lg border-2 border-edge p-3">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-paper p-1">
                {(
                  [
                    ["cash", "Cash"],
                    ["duitnow_qr", "DuitNow QR"],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    disabled={m === "duitnow_qr" && !online}
                    onClick={() => setMethod(m)}
                    aria-pressed={method === m}
                    className={cn(
                      "rounded-md py-2 text-sm font-semibold disabled:opacity-40",
                      method === m ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
                    )}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
              {method === "cash" ? (
                <div className="space-y-2">
                  <p className="text-sm text-ink-soft">
                    {t("Cash due")} <span className="num font-bold text-ink">{rm(cashDue)}</span>
                    {cashDue !== totals.total ? ` ${t("(rounded to 5 sen)")}` : ""}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {quickCash.map((v) => (
                      <button
                        key={v}
                        onClick={() => setTendered((v / 100).toFixed(2))}
                        className="num rounded-md border-2 border-edge py-2 text-sm font-semibold hover:bg-tag-soft"
                      >
                        {v === cashDue ? t("Exact") : (v / 100).toFixed(0)}
                      </button>
                    ))}
                  </div>
                  <Input
                    inputMode="decimal"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    placeholder={t("Cash received, e.g. 50")}
                    aria-label={t("Cash received")}
                    className="num h-12 text-lg"
                  />
                  {Number.isFinite(tSen) && tSen >= cashDue ? (
                    <p className="num text-right text-lg font-bold">{t("Change {amount}", { amount: rm(tSen - cashDue) })}</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-ink-soft">
                    {t("Customer scans your DuitNow QR at the counter. Check your bank app, then enter the reference.")}
                  </p>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("Bank reference (last 4–6 digits)")} />
                </div>
              )}
              <Button
                size="xl"
                className="w-full"
                disabled={busy || lines.length === 0 || payBlocked}
                onClick={() =>
                  submit(
                    method === "cash"
                      ? { method, tendered: tendered ? tSen : undefined }
                      : { method, reference: reference.trim() },
                  )
                }
              >
                {busy ? t("Saving…") : t("Receive {amount}", { amount: rm(method === "cash" ? cashDue : totals.total) })}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setPaying(false)}>
                {t("Back")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-2">
              <Button
                size="xl"
                className="w-full"
                disabled={busy || lines.length === 0}
                onClick={() => {
                  setError(undefined);
                  setDone(undefined);
                  if (!online) setMethod("cash");
                  setPaying(true);
                }}
              >
                {t("Pay now · {amount}", { amount: rm(cashDue) })}
              </Button>
              <Button size="lg" variant="secondary" className="w-full" disabled={busy || lines.length === 0} onClick={() => submit()}>
                {busy ? t("Sending…") : online ? t("Send to kitchen & bill") : (
                  <>
                    <CloudOff className="size-4" aria-hidden /> {t("Save order on this device")}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </aside>

      {picking ? (
        <OptionsDialog
          item={picking}
          onClose={() => setPicking(null)}
          onAdd={(ids, qty, n, price) => {
            add(picking, ids, qty, n, price);
            setPicking(null);
          }}
        />
      ) : null}
    </div>
  );
}

function DoneNote({ done }: { done: Done }) {
  const t = useT();
  if (done.payError)
    return (
      <div role="status" className="rounded-md border-2 border-chili bg-chili-soft px-3 py-2 text-sm text-chili">
        <p className="font-semibold">
          {t("Order #{n} is in, but not paid: {reason}", { n: done.orderNo ?? "?", reason: done.payError })}
        </p>
        {done.id ? (
          <Link href={`/app/orders/${done.id}`} className="font-bold underline">
            {t("Open the bill")}
          </Link>
        ) : null}
      </div>
    );
  if (done.offline)
    return (
      <p role="status" className="rounded-md border-2 border-teh bg-teh-soft px-3 py-2 text-sm font-semibold text-teh">
        {done.change ? `${t("Change {amount}", { amount: rm(done.change) })}. ` : ""}
        {t("Paid in cash and saved on this device. Tell the kitchen now; it's sent to the system when the internet is back.")}
      </p>
    );
  return (
    <div role="status" className="rounded-md border-2 border-pandan bg-pandan-soft px-3 py-2 text-pandan-dark">
      <p className="text-sm font-semibold">{t("Paid · Order #{n}", { n: done.orderNo ?? "?" })}</p>
      {done.change !== null ? <p className="num font-display text-2xl font-bold">{t("Change {amount}", { amount: rm(done.change) })}</p> : null}
      <div className="mt-1 flex gap-3 text-sm font-bold">
        {done.publicToken ? (
          <a href={`/r/${done.publicToken}?print=1`} target="_blank" rel="noreferrer" className="underline">
            {t("Print receipt")}
          </a>
        ) : null}
        {done.id ? (
          <Link href={`/app/orders/${done.id}`} className="underline">
            {t("Open the bill")}
          </Link>
        ) : null}
      </div>
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
  onAdd: (ids: string[], qty: number, note: string, price?: number) => void;
}) {
  const t = useT();
  const [ids, setIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [priceText, setPriceText] = useState("");
  const typed = toSen(priceText);
  const price = item.openPrice ? typed : undefined;
  const badPrice = item.openPrice && !(Number.isInteger(typed) && typed >= 1 && typed <= MAX_OPEN_PRICE);
  const quick = [...new Set([item.price, ...QUICK_PRICES].filter((p) => p > 0))];
  const missing = item.groups.find((g) => g.required && !g.options.some((o) => ids.includes(o.id)));
  const ready = !missing && !badPrice;
  const addIt = () => ready && onAdd(ids, qty, note.trim(), price);
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
      <button className="absolute inset-0 bg-black/50" onClick={onClose} aria-label={t("Close")} />
      <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-xl font-bold">{item.name}</h2>
          <button onClick={onClose} aria-label={t("Close")} className="p-1 text-ink-soft">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-4">
          {item.openPrice ? (
            <div>
              <label htmlFor="open-price" className="mb-2 block text-sm font-semibold">
                {t("Price (RM)")}
              </label>
              <Input
                id="open-price"
                autoFocus
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addIt()}
                inputMode="decimal"
                placeholder="8.50"
                className="num h-14 text-2xl"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {quick.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriceText((p / 100).toFixed(2))}
                    aria-pressed={typed === p}
                    className={cn(
                      "num rounded-lg border px-3 py-2 text-sm font-semibold",
                      typed === p ? "border-pandan bg-pandan-soft text-pandan-dark" : "border-line",
                    )}
                  >
                    {(p / 100).toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {item.groups.map((g) => (
            <div key={g.id}>
              <p className="mb-2 text-sm font-semibold">
                {g.name} <span className="font-normal text-mute">{g.required ? t("(required)") : t("(optional)")}</span>
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
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={item.openPrice ? t("What's on the plate (optional)") : t("Kitchen note")}
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-md border-2 border-edge">
              <button className="grid size-10 place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={t("Less")}>
                <Minus className="size-4" />
              </button>
              <span className="num w-6 text-center font-bold">{qty}</span>
              <button className="grid size-10 place-items-center" onClick={() => setQty((q) => Math.min(99, q + 1))} aria-label={t("More")}>
                <Plus className="size-4" />
              </button>
            </div>
            <Button size="lg" className="flex-1" disabled={!ready} onClick={addIt}>
              {missing
                ? t("Choose {name}", { name: missing.name })
                : badPrice
                  ? t("Enter the price")
                  : t("Add · {amount}", { amount: rm(unit(item, ids, price) * qty) })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
