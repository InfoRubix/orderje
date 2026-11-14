"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
import { useT } from "@/components/i18n";
import { chime } from "@/components/ready-alert";

type Num = { id: string; orderNo: number; label: string | null };

/**
 * For a TV or tablet facing the customers: big order numbers, "being made" and "ready to collect".
 * Customers with no phone or no data watch this instead of the order page. Chimes when a new
 * number turns ready (after "Turn on sound", since browsers need a tap first).
 */
export function CallingBoard({ shop }: { shop: string }) {
  const t = useT();
  const [data, setData] = useState<{ preparing: Num[]; ready: Num[] } | null>(null);
  const [offline, setOffline] = useState(false);
  const [sound, setSound] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/display", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as { preparing: Num[]; ready: Num[] };
        if (!alive) return;
        const ids = new Set(d.ready.map((n) => n.id));
        // First load: everything already ready is old news, no chime.
        const added = seen.current ? d.ready.filter((n) => !seen.current!.has(n.id)).map((n) => n.id) : [];
        seen.current = ids;
        if (added.length) {
          setFresh(new Set(added));
          setTimeout(() => alive && setFresh(new Set()), 20_000);
          if (soundRef.current) chime(ctx.current);
        }
        setData(d);
        setOffline(false);
      } catch {
        if (alive) setOffline(true);
      }
    }
    load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  function toggleSound() {
    if (!sound) {
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx.current ??= new Ctx();
        ctx.current.resume();
        chime(ctx.current);
      } catch {}
    }
    setSound((s) => !s);
  }

  return (
    <div ref={box} className="flex min-h-[80dvh] flex-col bg-paper">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{shop}</h1>
        <div className="flex gap-2">
          <Button variant={sound ? "primary" : "secondary"} onClick={toggleSound}>
            {sound ? <Bell className="size-4" /> : <BellOff className="size-4" />}
            {sound ? t("Sound on") : t("Turn on sound")}
          </Button>
          <Button variant="secondary" onClick={() => box.current?.requestFullscreen?.()}>
            <Maximize className="size-4" /> {t("Full screen")}
          </Button>
        </div>
      </div>
      {offline ? <p className="mb-3 font-semibold text-chili">{t("Connection lost, retrying…")}</p> : null}
      <div className="grid flex-1 gap-4 md:grid-cols-[2fr_3fr]">
        <section className="rounded-xl border-4 border-edge bg-surface p-4" aria-label={t("Being made")}>
          <h2 className="mb-3 font-display text-2xl text-ink-soft md:text-3xl">{t("Being made")}</h2>
          <ul className="flex flex-wrap gap-3">
            {data?.preparing.map((n) => (
              <li key={n.id} className="min-w-24 rounded-lg bg-paper px-3 py-2 text-center">
                <p className="num font-display text-4xl font-bold md:text-5xl">{n.orderNo}</p>
                {n.label ? <p className="truncate text-sm text-ink-soft">{n.label}</p> : null}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border-4 border-edge bg-tag p-4 text-on-tag" aria-label={t("Ready to collect")}>
          <h2 className="mb-3 font-display text-2xl md:text-3xl">{t("Ready to collect")}</h2>
          {data && data.ready.length === 0 ? <p className="text-lg opacity-80">{t("Nothing ready yet.")}</p> : null}
          <ul className="flex flex-wrap gap-4">
            {data?.ready.map((n) => (
              <li
                key={n.id}
                className={cn("min-w-32 rounded-lg bg-surface px-4 py-3 text-center text-ink", fresh.has(n.id) && "ready-pulse")}
              >
                <p className="num font-display text-6xl font-bold md:text-7xl">{n.orderNo}</p>
                {n.label ? <p className="truncate text-base font-semibold text-ink-soft">{n.label}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
