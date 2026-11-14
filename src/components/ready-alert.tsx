"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import type { OrderStatus } from "@/db/schema";
import { Button } from "@/components/ui";

/** Three rising double-beeps, loud enough for a busy kedai. */
export function chime(ctx?: AudioContext | null) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = ctx ?? new Ctx();
    [0, 0.5, 1].forEach((start, n) =>
      [0, 0.16].forEach((off) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.frequency.value = 880 + n * 110;
        const t = ac.currentTime + start + off;
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        o.connect(g).connect(ac.destination);
        o.start(t);
        o.stop(t + 0.15);
      }),
    );
  } catch {}
}

type Text = { arm: string; armed: string; ready: string; readyTitle: string; keepOpen: string };

/**
 * On the customer's order page: when the kitchen marks the order ready, beep, vibrate and show a
 * big banner. Browsers only allow sound after a tap, so the customer taps "Alert me" once; the
 * screen is also kept awake so the page keeps checking. Works only while this page is open.
 */
export function ReadyAlert({ token, status, text }: { token: string; status: OrderStatus; text: Text }) {
  const [armed, setArmed] = useState(false);
  const ctx = useRef<AudioContext | null>(null);
  const lock = useRef<{ release(): Promise<void> } | null>(null);
  const ready = status === "ready";

  async function arm() {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx.current = new Ctx();
      await ctx.current.resume();
    } catch {}
    navigator.vibrate?.(80);
    try {
      lock.current = (await (navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen")) ?? null;
    } catch {}
    setArmed(true);
  }

  useEffect(() => {
    if (!ready) return;
    // Alert once per order, even though the page re-renders every few seconds.
    const key = `orderterus:ready:${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    chime(ctx.current);
    navigator.vibrate?.([400, 150, 400, 150, 800]);
    const old = document.title;
    document.title = text.readyTitle;
    return () => {
      document.title = old;
    };
  }, [ready, token, text.readyTitle]);

  useEffect(() => () => void lock.current?.release().catch(() => {}), []);

  if (ready)
    return (
      <div role="alert" className="ready-pulse rounded-xl border-4 border-edge bg-tag p-5 text-center text-on-tag">
        <BellRing className="mx-auto size-10" aria-hidden />
        <p className="mt-2 font-display text-3xl font-bold leading-tight">{text.ready}</p>
      </div>
    );
  if (status !== "new" && status !== "preparing") return null;
  return armed ? (
    <p className="flex items-center justify-center gap-2 rounded-xl bg-pandan-soft p-3 text-sm font-semibold text-pandan-dark">
      <BellRing className="size-4" aria-hidden /> {text.armed}
    </p>
  ) : (
    <div className="space-y-1 text-center">
      <Button size="lg" variant="secondary" className="w-full" onClick={arm}>
        <BellRing className="size-5" aria-hidden /> {text.arm}
      </Button>
      <p className="text-xs text-mute">{text.keepOpen}</p>
    </div>
  );
}
