"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Bell, BellOff, Maximize } from "lucide-react";
import type { OrderStatus } from "@/db/schema";
import { ORDER_TYPE_LABEL } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { Badge, Button, Empty } from "@/components/ui";
import { setOrderStatus } from "../actions";

type Ticket = {
  id: string;
  orderNo: number;
  status: OrderStatus;
  orderType: "dine_in" | "takeaway" | "delivery";
  source: "qr" | "counter";
  tableLabel: string | null;
  customerName: string | null;
  note: string | null;
  paymentStatus: string;
  createdAt: number;
  items: { id: string; name: string; qty: number; modifiers: string | null; note: string | null }[];
};

const COLUMNS: { status: OrderStatus; title: string; next: OrderStatus; action: string }[] = [
  { status: "new", title: "New", next: "preparing", action: "Start cooking" },
  { status: "preparing", title: "Cooking", next: "ready", action: "Mark ready" },
  { status: "ready", title: "Ready to serve", next: "served", action: "Served" },
];

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.18].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.16);
    });
  } catch {}
}

export function KitchenBoard({ canCancel }: { canCancel: boolean }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);
  const [, start] = useTransition();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kitchen", { cache: "no-store" });
      if (res.status === 401) return window.location.assign("/login");
      const data = (await res.json()) as { orders: Ticket[]; now: number };
      setOffline(false);
      setNow(data.now);
      const ids = new Set(data.orders.map((o) => o.id));
      if (seen.current) {
        const added = data.orders.filter((o) => !seen.current!.has(o.id)).map((o) => o.id);
        if (added.length) {
          setFresh(new Set(added));
          if (sound) beep();
        }
      }
      seen.current = ids;
      setTickets(data.orders);
    } catch {
      setOffline(true);
    }
  }, [sound]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  function move(t: Ticket, status: OrderStatus) {
    setTickets((cur) => cur && cur.map((x) => (x.id === t.id ? { ...x, status } : x)).filter((x) => x.status !== "served" && x.status !== "cancelled"));
    start(async () => {
      const r = await setOrderStatus(t.id, status);
      if (r?.error) alert(r.error);
      load();
    });
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">Kitchen</h1>
          <p className="text-sm text-ink-soft">
            {offline ? <span className="font-semibold text-chili">Connection lost, retrying…</span> : "Updates every few seconds."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={sound ? "primary" : "secondary"}
            onClick={() => {
              setSound((s) => !s);
              if (!sound) beep();
            }}
          >
            {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            {sound ? "Sound on" : "Turn on sound"}
          </Button>
          <Button variant="secondary" onClick={() => document.documentElement.requestFullscreen?.()}>
            <Maximize className="size-4" /> Full screen
          </Button>
        </div>
      </div>

      {tickets === null ? (
        <p className="text-ink-soft">Loading orders…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = tickets.filter((t) => t.status === col.status);
            return (
              <section key={col.status} aria-label={col.title}>
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                  {col.title}
                  <span className="num rounded-md bg-ink px-2 text-sm text-on-ink">{list.length}</span>
                </h2>
                <div className="space-y-5">
                  {list.length === 0 ? (
                    <Empty title={col.status === "new" ? "No new orders" : "Nothing here"} />
                  ) : (
                    list.map((t) => {
                      const mins = Math.max(0, Math.floor((now - t.createdAt) / 60000));
                      return (
                        <article key={t.id} className={cn("slip rounded-t-lg px-4 pb-4 pt-3", fresh.has(t.id) && "arrive")}>
                          <header className="flex items-start justify-between gap-2 border-b border-dashed border-line pb-2">
                            <div>
                              <p className="num font-display text-2xl font-bold leading-none">#{t.orderNo}</p>
                              <p className="mt-1 text-sm font-semibold">
                                {t.tableLabel ?? ORDER_TYPE_LABEL[t.orderType]}
                                {t.customerName ? ` · ${t.customerName}` : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={cn("num text-sm font-bold", mins >= 15 ? "text-chili" : mins >= 8 ? "text-teh" : "text-ink-soft")}>
                                {mins} min
                              </p>
                              <div className="mt-1 flex justify-end gap-1">
                                {t.orderType !== "dine_in" ? <Badge tone="amber">{ORDER_TYPE_LABEL[t.orderType]}</Badge> : null}
                                {t.source === "qr" ? <Badge>QR</Badge> : null}
                              </div>
                            </div>
                          </header>
                          <ul className="space-y-1.5 py-3">
                            {t.items.map((i) => (
                              <li key={i.id} className="flex gap-2">
                                <span className="num w-7 shrink-0 text-lg font-bold">{i.qty}×</span>
                                <div>
                                  <p className="text-lg font-semibold leading-snug">{i.name}</p>
                                  {i.modifiers ? <p className="text-sm text-ink-soft">{i.modifiers}</p> : null}
                                  {i.note ? <p className="text-sm font-semibold text-chili">“{i.note}”</p> : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                          {t.note ? <p className="mb-3 rounded bg-teh-soft px-2 py-1 text-sm font-semibold text-teh">Note: {t.note}</p> : null}
                          <div className="flex gap-2">
                            <Button size="lg" className="flex-1" onClick={() => move(t, col.next)}>
                              {col.action}
                            </Button>
                            {col.status === "new" && canCancel ? (
                              <Button
                                size="lg"
                                variant="secondary"
                                onClick={() => confirm(`Cancel order #${t.orderNo}?`) && move(t, "cancelled")}
                              >
                                Cancel
                              </Button>
                            ) : null}
                            {col.status !== "new" ? (
                              <Button size="lg" variant="ghost" onClick={() => move(t, col.status === "ready" ? "preparing" : "new")}>
                                Undo
                              </Button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
