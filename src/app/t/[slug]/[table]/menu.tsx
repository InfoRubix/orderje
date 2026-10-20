"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import type { Menu, MenuItemFull } from "@/lib/orders";
import { computeTotals } from "@/lib/pricing";
import { rm } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button, FormError, Input, Textarea } from "@/components/ui";
import { placeQrOrder } from "../../actions";

type Rates = Parameters<typeof computeTotals>[0];
type CartLine = { key: string; item: MenuItemFull; qty: number; optionIds: string[]; note: string };

function unitPrice(item: MenuItemFull, optionIds: string[]) {
  const opts = item.groups.flatMap((g) => g.options);
  return item.price + optionIds.reduce((s, id) => s + (opts.find((o) => o.id === id)?.price ?? 0), 0);
}

function optionNames(item: MenuItemFull, optionIds: string[]) {
  const opts = item.groups.flatMap((g) => g.options);
  return optionIds.map((id) => opts.find((o) => o.id === id)?.name).filter(Boolean).join(", ");
}

export function CustomerMenu({
  slug,
  table,
  tableLabel,
  shop,
  menu,
  rates,
}: {
  slug: string;
  table: string;
  tableLabel: string | null;
  shop: { name: string; address: string | null };
  menu: Menu;
  rates: Rates;
}) {
  const router = useRouter();
  const storageKey = `oj-cart:${slug}:${table}`;
  const [cart, setCart] = useState<CartLine[]>([]);
  const [picking, setPicking] = useState<MenuItemFull | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(menu[0]?.id);
  const isTakeawayLink = table === "takeaway";
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">(isTakeawayLink ? "takeaway" : "dine_in");

  // Restore cart if the customer refreshes or locks their phone.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { itemId: string; qty: number; optionIds: string[]; note: string }[];
      const all = menu.flatMap((c) => c.items);
      setCart(
        saved.flatMap((s) => {
          const item = all.find((i) => i.id === s.itemId);
          return item ? [{ key: crypto.randomUUID(), item, qty: s.qty, optionIds: s.optionIds, note: s.note }] : [];
        }),
      );
    } catch {}
  }, [menu, storageKey]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify(cart.map((l) => ({ itemId: l.item.id, qty: l.qty, optionIds: l.optionIds, note: l.note }))),
      );
    } catch {}
  }, [cart, storageKey]);

  const subtotal = cart.reduce((s, l) => s + unitPrice(l.item, l.optionIds) * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const totals = computeTotals(rates, subtotal, "walk_in", orderType);

  const catRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveCat(top.target.id.replace("cat-", ""));
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    Object.values(catRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [menu]);

  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-paper pb-28">
      <header className="bg-pandan px-5 pb-5 pt-6 text-white">
        <p className="text-sm text-white/75">{tableLabel ? `You're at ${tableLabel}` : "Takeaway order"}</p>
        <h1 className="font-display text-3xl font-bold leading-tight">{shop.name}</h1>
        {shop.address ? <p className="mt-1 text-sm text-white/75">{shop.address}</p> : null}
      </header>

      <nav className="sticky top-0 z-20 flex gap-2 overflow-x-auto border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        {menu.map((c) => (
          <a
            key={c.id}
            href={`#cat-${c.id}`}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold",
              activeCat === c.id ? "bg-ink text-white" : "bg-surface text-ink-soft border border-line",
            )}
          >
            {c.name}
          </a>
        ))}
      </nav>

      {menu.length === 0 ? (
        <p className="p-8 text-center text-ink-soft">The menu is being updated. Please order at the counter.</p>
      ) : null}

      {menu.map((c) => (
        <section
          key={c.id}
          id={`cat-${c.id}`}
          ref={(el) => {
            catRefs.current[c.id] = el;
          }}
          className="scroll-mt-16 px-4 pt-6"
        >
          <h2 className="mb-2 font-display text-xl font-bold">{c.name}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {c.items.map((item) => {
              const inCart = cart.filter((l) => l.item.id === item.id).reduce((s, l) => s + l.qty, 0);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setPicking(item)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-paper"
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{item.name}</p>
                      {item.description ? <p className="line-clamp-2 text-sm text-ink-soft">{item.description}</p> : null}
                      <p className="num mt-0.5 text-sm font-semibold text-pandan-dark">{rm(item.price)}</p>
                    </div>
                    {inCart ? (
                      <span className="num grid size-8 place-items-center rounded-full bg-pandan text-sm font-bold text-white">
                        {inCart}
                      </span>
                    ) : (
                      <span className="grid size-8 place-items-center rounded-full border border-line text-pandan">
                        <Plus className="size-4" aria-hidden />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl p-3">
          <button
            onClick={() => setCartOpen(true)}
            className="flex h-14 w-full items-center justify-between rounded-xl bg-ink px-5 text-white shadow-lg"
          >
            <span className="flex items-center gap-2 font-semibold">
              <ShoppingBag className="size-5" aria-hidden /> View order ({count})
            </span>
            <span className="num font-bold">{rm(totals.total)}</span>
          </button>
        </div>
      ) : null}

      {picking ? (
        <ItemSheet
          item={picking}
          onClose={() => setPicking(null)}
          onAdd={(line) => {
            setCart((c) => [...c, { ...line, key: crypto.randomUUID() }]);
            setPicking(null);
          }}
        />
      ) : null}

      {cartOpen ? (
        <CartSheet
          cart={cart}
          setCart={setCart}
          totals={totals}
          orderType={orderType}
          setOrderType={isTakeawayLink ? undefined : setOrderType}
          onClose={() => setCartOpen(false)}
          onPlace={async (info) => {
            const res = await placeQrOrder({
              slug,
              table,
              orderType,
              ...info,
              lines: cart.map((l) => ({ menuItemId: l.item.id, qty: l.qty, optionIds: l.optionIds, note: l.note || undefined })),
            });
            if (res.token) {
              try {
                sessionStorage.removeItem(storageKey);
              } catch {}
              router.push(`/o/${res.token}`);
            }
            return res.error;
          }}
        />
      ) : null}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal aria-label={title}>
      <button className="absolute inset-0 bg-ink/50" onClick={onClose} aria-label="Close" />
      <div className="relative flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-2xl bg-surface">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-ink-soft hover:bg-paper" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Stepper({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line">
      <button
        type="button"
        className="grid size-10 place-items-center text-ink-soft disabled:opacity-30"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label="Less"
      >
        <Minus className="size-4" />
      </button>
      <span className="num w-6 text-center font-bold">{value}</span>
      <button
        type="button"
        className="grid size-10 place-items-center text-ink-soft"
        onClick={() => onChange(Math.min(99, value + 1))}
        aria-label="More"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function ItemSheet({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItemFull;
  onClose: () => void;
  onAdd: (l: Omit<CartLine, "key">) => void;
}) {
  const [qty, setQty] = useState(1);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const missing = item.groups.filter((g) => g.required && !g.options.some((o) => optionIds.includes(o.id)));

  function toggle(groupId: string, optionId: string) {
    const g = item.groups.find((x) => x.id === groupId)!;
    const inGroup = g.options.map((o) => o.id);
    setOptionIds((cur) => {
      if (cur.includes(optionId)) return cur.filter((x) => x !== optionId);
      const chosen = cur.filter((x) => inGroup.includes(x));
      if (g.maxSelect === 1) return [...cur.filter((x) => !inGroup.includes(x)), optionId];
      if (chosen.length >= g.maxSelect) return cur;
      return [...cur, optionId];
    });
  }

  return (
    <Sheet title={item.name} onClose={onClose}>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {item.description ? <p className="text-ink-soft">{item.description}</p> : null}
        {item.groups.map((g) => (
          <fieldset key={g.id}>
            <legend className="mb-2 flex w-full items-baseline justify-between">
              <span className="font-semibold">{g.name}</span>
              <span className={cn("text-xs", g.required ? "font-semibold text-teh" : "text-mute")}>
                {g.required ? "Required" : "Optional"}
                {g.maxSelect > 1 ? `, up to ${g.maxSelect}` : ""}
              </span>
            </legend>
            <div className="divide-y divide-line rounded-lg border border-line">
              {g.options.map((o) => {
                const on = optionIds.includes(o.id);
                return (
                  <label key={o.id} className="flex cursor-pointer items-center gap-3 px-3 py-3">
                    <input
                      type={g.maxSelect === 1 ? "radio" : "checkbox"}
                      name={g.id}
                      checked={on}
                      onChange={() => toggle(g.id, o.id)}
                      onClick={() => g.maxSelect === 1 && on && !g.required && toggle(g.id, o.id)}
                      className="size-4.5 accent-pandan"
                    />
                    <span className="flex-1">{o.name}</span>
                    {o.price ? <span className="num text-sm text-ink-soft">+{rm(o.price)}</span> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        <label className="block">
          <span className="mb-1.5 block font-semibold">Note for the kitchen</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={160} placeholder="e.g. no onion" />
        </label>
      </div>
      <div className="flex items-center gap-3 border-t border-line px-5 py-4">
        <Stepper value={qty} onChange={setQty} />
        <Button
          size="lg"
          className="flex-1"
          disabled={missing.length > 0}
          onClick={() => onAdd({ item, qty, optionIds, note: note.trim() })}
        >
          {missing.length ? `Choose ${missing[0].name}` : `Add · ${rm(unitPrice(item, optionIds) * qty)}`}
        </Button>
      </div>
    </Sheet>
  );
}

function CartSheet({
  cart,
  setCart,
  totals,
  orderType,
  setOrderType,
  onClose,
  onPlace,
}: {
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  totals: ReturnType<typeof computeTotals>;
  orderType: "dine_in" | "takeaway";
  setOrderType?: (t: "dine_in" | "takeaway") => void;
  onClose: () => void;
  onPlace: (info: { customerName?: string; customerPhone?: string; note?: string }) => Promise<string | undefined>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const needsName = orderType === "takeaway";
  const lines = useMemo(() => cart, [cart]);

  return (
    <Sheet title="Your order" onClose={onClose}>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {setOrderType ? (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-paper p-1" role="radiogroup" aria-label="Order type">
            {(["dine_in", "takeaway"] as const).map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={orderType === t}
                onClick={() => setOrderType(t)}
                className={cn(
                  "rounded-md py-2 text-sm font-semibold",
                  orderType === t ? "bg-surface text-ink shadow-sm" : "text-ink-soft",
                )}
              >
                {t === "dine_in" ? "Makan sini" : "Bungkus"}
              </button>
            ))}
          </div>
        ) : null}

        <ul className="divide-y divide-line">
          {lines.map((l) => (
            <li key={l.key} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.item.name}</p>
                {l.optionIds.length ? <p className="text-sm text-ink-soft">{optionNames(l.item, l.optionIds)}</p> : null}
                {l.note ? <p className="text-sm italic text-ink-soft">“{l.note}”</p> : null}
                <p className="num mt-1 text-sm font-semibold">{rm(unitPrice(l.item, l.optionIds) * l.qty)}</p>
              </div>
              <Stepper
                value={l.qty}
                min={0}
                onChange={(n) =>
                  setCart((c) => (n <= 0 ? c.filter((x) => x.key !== l.key) : c.map((x) => (x.key === l.key ? { ...x, qty: n } : x))))
                }
              />
            </li>
          ))}
        </ul>

        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={needsName ? "Your name (required)" : "Your name (optional)"}
            maxLength={120}
            autoComplete="name"
          />
          {needsName ? (
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              inputMode="tel"
              maxLength={32}
              autoComplete="tel"
            />
          ) : null}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the whole order" maxLength={255} />
        </div>

        <dl className="num space-y-1 text-sm">
          <Row label="Subtotal" value={totals.subtotal} />
          {totals.serviceCharge ? <Row label="Service charge" value={totals.serviceCharge} /> : null}
          {totals.sst ? <Row label="SST" value={totals.sst} /> : null}
          <div className="flex justify-between pt-1 text-base font-bold">
            <dt>Total</dt>
            <dd>{rm(totals.total)}</dd>
          </div>
        </dl>
        <FormError message={error} />
      </div>
      <div className="border-t border-line px-5 py-4">
        <Button
          size="xl"
          className="w-full"
          disabled={pending || cart.length === 0 || (needsName && !name.trim())}
          onClick={() =>
            start(async () => {
              setError(undefined);
              const err = await onPlace({ customerName: name || undefined, customerPhone: phone || undefined, note: note || undefined });
              if (err) setError(err);
            })
          }
        >
          {pending ? "Sending to kitchen…" : "Send order to kitchen"}
        </Button>
        <p className="mt-2 text-center text-xs text-mute">You can pay online now or at the counter after.</p>
      </div>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{label}</dt>
      <dd>{rm(value)}</dd>
    </div>
  );
}
