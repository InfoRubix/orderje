"use client";

import { useState } from "react";
import { rm } from "@/lib/money";

/**
 * Single-series bar chart (magnitude = one hue). Hover/focus shows a tooltip;
 * a visually-hidden table carries the same data for screen readers.
 */
export function BarChart({
  data,
  label,
  height = 160,
}: {
  data: { key: string; label: string; value: number; sub?: string }[];
  label: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  return (
    <figure className="relative">
      <div className="flex gap-2">
        <div className="num flex flex-col justify-between pb-6 text-right text-[11px] text-mute" style={{ height }}>
          <span>{(nice / 100).toFixed(0)}</span>
          <span>{(nice / 200).toFixed(0)}</span>
          <span>0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="relative flex items-end gap-[2px] border-b border-line"
            style={{ height: height - 24 }}
            onMouseLeave={() => setHover(null)}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
            {hover !== null ? (
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-lg bg-ink px-3 py-2 text-xs text-on-ink shadow-lg"
                style={{ left: `${Math.min(90, Math.max(10, ((hover + 0.5) / data.length) * 100))}%` }}
              >
                <p className="font-semibold">{data[hover].label}</p>
                <p className="num">{rm(data[hover].value)}</p>
                {data[hover].sub ? <p className="opacity-70">{data[hover].sub}</p> : null}
              </div>
            ) : null}
            {data.map((d, i) => (
              <button
                key={d.key}
                type="button"
                className="group relative flex h-full flex-1 items-end focus:outline-none"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.label}: ${rm(d.value)}${d.sub ? `, ${d.sub}` : ""}`}
              >
                <span
                  className="w-full rounded-t-[4px] bg-pandan transition-opacity"
                  style={{
                    height: `${(d.value / nice) * 100}%`,
                    minHeight: d.value > 0 ? 2 : 0,
                    opacity: hover === null || hover === i ? 1 : 0.45,
                  }}
                />
              </button>
            ))}
          </div>
          <div className="num mt-1 flex gap-[2px] text-[11px] text-mute">
            {data.map((d, i) => (
              <span key={d.key} className="flex-1 truncate text-center">
                {data.length <= 14 || i % 3 === 0 ? d.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        {label}. Highest: {data[peak]?.label} at {rm(data[peak]?.value ?? 0)}.
      </figcaption>
      <table className="sr-only">
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th>{d.label}</th>
              <td>{rm(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function niceMax(v: number) {
  const steps = [500, 1000, 2000, 5000];
  let scale = 1;
  for (;;) {
    for (const s of steps) if (s * scale >= v) return s * scale;
    scale *= 10;
  }
}
