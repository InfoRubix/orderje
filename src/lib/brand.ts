import type { CSSProperties } from "react";
import { DEFAULT_BRAND_COLOR } from "@/db/schema";

/** Preset brand colours offered in Brand & profile. */
export const BRAND_PRESETS: [name: string, hex: string][] = [
  ["Merah cili", "#d92d20"],
  ["Hijau kedai", "#28584a"],
  ["Pandan", "#1f7a4d"],
  ["Teh tarik", "#a8681a"],
  ["Biru laut", "#1f5f9e"],
  ["Ungu", "#6b3fa0"],
  ["Arang", "#2b2f36"],
  ["Kunyit", "#e0a526"],
  ["Merah jambu", "#d0477a"],
];

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Inline style for a `.brand` wrapper: the kedai colour, readable text on top of it, and how
 * much to darken it for prices and links (light colours like kunyit need more).
 */
export function brandStyle(color: string | null | undefined): CSSProperties {
  const c = color && /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_BRAND_COLOR;
  const light = luminance(c) > 0.42;
  return {
    "--brand": c,
    "--on-brand": light ? "#1d2433" : "#ffffff",
    "--brand-shade": light ? "55%" : "72%",
  } as CSSProperties;
}
