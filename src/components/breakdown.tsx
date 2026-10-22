import { rm } from "@/lib/money";

/** Share-of-total rows: label + count on the left, amount + share on the right, one-hue bar. */
export function Breakdown({
  rows,
  total,
  empty = "No sales in this period.",
}: {
  rows: { label: string; value: number; n: number }[];
  total: number;
  empty?: string;
}) {
  if (!rows.some((r) => r.value > 0)) return <p className="text-sm text-mute">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const share = total ? r.value / total : 0;
        return (
          <li key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">
                {r.label} <span className="num text-mute">· {r.n}</span>
              </span>
              <span className="num font-semibold">
                {rm(r.value)} <span className="font-normal text-mute">{Math.round(share * 100)}%</span>
              </span>
            </div>
            <div className="h-2.5 rounded-xs bg-line/70">
              <div className="h-2.5 rounded-xs bg-ink" style={{ width: `${Math.max(share * 100, r.value ? 1.5 : 0)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
