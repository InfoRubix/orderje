"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RefreshCw, Trash2 } from "lucide-react";
import { createCounterOrder } from "@/app/app/actions";
import { readQueue, removeQueued, setQueuedError, useOnline, useQueue } from "@/lib/offline-queue";
import { rm } from "@/lib/money";
import { Button } from "@/components/ui";
import { useT } from "@/components/i18n";

/**
 * Shown on every staff screen: says when the device is offline, and sends the counter orders
 * saved while offline as soon as the internet is back (one at a time, oldest first).
 */
export function OfflineSync({ tenantId }: { tenantId: string }) {
  const t = useT();
  const router = useRouter();
  const online = useOnline();
  const queue = useQueue(tenantId);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);

  // Lets the counter screen open again with no internet (see public/sw.js).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const flush = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    const pending = readQueue().filter((o) => o.tenantId === tenantId && !o.error);
    if (!pending.length) return;
    busy.current = true;
    setSending(true);
    let sent = 0;
    try {
      for (const o of pending) {
        let r: Awaited<ReturnType<typeof createCounterOrder>>;
        try {
          r = await createCounterOrder({ ...o.input, clientId: o.clientId, queuedAt: o.queuedAt });
        } catch {
          break; // still no internet: keep the rest and try again later
        }
        if (r?.error) setQueuedError(o.clientId, r.error);
        else {
          removeQueued(o.clientId);
          sent++;
        }
      }
    } finally {
      busy.current = false;
      setSending(false);
      if (sent) router.refresh();
    }
  }, [tenantId, router]);

  const waiting = queue.filter((o) => !o.error).length;

  useEffect(() => {
    if (!online || !waiting) return;
    flush();
    // The browser can report "online" on Wi-Fi with no internet, so keep trying quietly.
    const id = setInterval(flush, 10_000);
    return () => clearInterval(id);
  }, [online, waiting, flush]);

  const failed = queue.filter((o) => o.error);
  if (online && !queue.length) return null;

  return (
    <div className="no-print mb-4 space-y-2" role="status" aria-live="polite">
      {!online ? (
        <div className="flex items-start gap-2 rounded-xl border-2 border-chili bg-surface px-4 py-3 text-sm">
          <CloudOff className="mt-0.5 size-4 shrink-0 text-chili" aria-hidden />
          <p>
            <span className="font-semibold text-chili">{t("No internet.")}</span>{" "}
            {t("You can still take counter orders. They're saved on this device and go to the kitchen when the internet is back.")}
          </p>
        </div>
      ) : null}
      {waiting ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-teh bg-teh-soft px-4 py-3 text-sm">
          <p className="font-semibold text-teh">
            {sending
              ? t("Sending saved orders…")
              : waiting === 1
                ? t("1 order saved on this device, waiting for internet.")
                : t("{n} orders saved on this device, waiting for internet.", { n: waiting })}
          </p>
          {online && !sending ? (
            <Button size="sm" variant="secondary" onClick={flush}>
              <RefreshCw className="size-4" aria-hidden /> {t("Send now")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {failed.map((o) => (
        <div key={o.clientId} className="rounded-xl border-2 border-chili bg-surface px-4 py-3 text-sm">
          <p className="font-semibold">
            {t("Saved order not sent: {label}, {total}", { label: o.label, total: rm(o.total) })}
          </p>
          <p className="text-chili">{o.error}</p>
          <p className="text-ink-soft">
            {o.input.lines.length === 1
              ? t("1 item, taken at {time}", { time: new Date(o.queuedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
              : t("{n} items, taken at {time}", {
                  n: o.input.lines.length,
                  time: new Date(o.queuedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                })}
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setQueuedError(o.clientId, undefined);
              }}
            >
              <RefreshCw className="size-4" aria-hidden /> {t("Try again")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => confirm(t("Delete this saved order? It will not reach the kitchen or the reports.")) && removeQueued(o.clientId)}
            >
              <Trash2 className="size-4" aria-hidden /> {t("Delete")}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
