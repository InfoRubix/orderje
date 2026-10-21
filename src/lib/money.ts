/** All amounts are integer sen. */
export function rm(sen: number) {
  const sign = sen < 0 ? "-" : "";
  return `${sign}RM ${(Math.abs(sen) / 100).toFixed(2)}`;
}

/** Parse "12.50" / "12" / "RM12.5" into sen. Returns NaN on bad input. */
export function toSen(input: string | number | null | undefined) {
  if (input === null || input === undefined || input === "") return NaN;
  const cleaned = typeof input === "number" ? "" : String(input).replace(/[^0-9.\-]/g, "");
  if (typeof input !== "number" && !cleaned) return NaN; // "abc" is not zero
  const n = typeof input === "number" ? input : Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function pct(bp: number) {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
}

/** Bank Negara rounding for cash bills: nearest 5 sen. */
export function cashRound(sen: number) {
  return Math.round(sen / 5) * 5;
}
