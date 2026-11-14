"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { CounterOrderInput } from "@/app/app/actions";

/**
 * Counter orders taken while the internet is down, kept in this browser's localStorage until
 * <OfflineSync> sends them. Each one carries its own id (clientId), so sending it twice is safe.
 */
export type QueuedOrder = {
  clientId: string;
  tenantId: string;
  /** ISO time the cashier pressed save. */
  queuedAt: string;
  input: Omit<CounterOrderInput, "clientId" | "queuedAt">;
  /** For the banner: table, customer name or order type. */
  label: string;
  /** Estimated total in sen; the server re-prices it when it's sent. */
  total: number;
  /** Set when the server refused the order (not a network problem), so a person has to look. */
  error?: string;
};

const KEY = "orderterus:offline-orders:v1";
const EVENT = "orderterus:offline-orders";

function raw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(s: string): QueuedOrder[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function readQueue(): QueuedOrder[] {
  return parse(raw());
}

function write(list: QueuedOrder[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: nothing more we can do on the device.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Returns false if the browser wouldn't store it (private mode, storage full). */
export function enqueue(order: QueuedOrder): boolean {
  const list = readQueue().filter((o) => o.clientId !== order.clientId);
  write([...list, order]);
  return readQueue().some((o) => o.clientId === order.clientId);
}

export function removeQueued(clientId: string) {
  write(readQueue().filter((o) => o.clientId !== clientId));
}

export function setQueuedError(clientId: string, error: string | undefined) {
  write(readQueue().map((o) => (o.clientId === clientId ? { ...o, error } : o)));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // another tab on the same device
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** This kedai's queued orders, re-rendering whenever the queue changes. */
export function useQueue(tenantId: string) {
  const s = useSyncExternalStore(subscribe, raw, () => "[]");
  return useMemo(() => parse(s).filter((o) => o.tenantId === tenantId), [s, tenantId]);
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** The browser's own view of the connection. It can say online when the Wi-Fi has no internet. */
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
