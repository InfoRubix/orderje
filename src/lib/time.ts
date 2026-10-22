import { locale, type Lang } from "@/lib/i18n";

/** Business dates are in Malaysia time (UTC+8, no DST). */
const OFFSET_MS = 8 * 60 * 60 * 1000;

export function myDate(d: Date = new Date()) {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC range [start, end) covering one Malaysian business date (YYYY-MM-DD). */
export function dayRange(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function isValidDate(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export function fmtTime(d: Date, lang: Lang = "en") {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function fmtDateTime(d: Date, lang: Lang = "en") {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function minutesAgo(d: Date) {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
}
