import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ordersCreatedBetween } from "@/lib/repo";
import { salesReport } from "@/lib/reports";
import { rm } from "@/lib/money";
import { CUSTOMER_TYPE_LABEL, METHOD_LABEL, ORDER_TYPE_LABEL } from "@/lib/pricing";
import { isValidDate, myDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Card, PageHeader } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { Breakdown } from "@/components/breakdown";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function shift(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
] as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const { tenant } = await requireUser(["owner"]);
  const sp = await searchParams;
  const today = myDate();
  let from = today;
  let to = today;
  let range = sp.range ?? "today";
  if (range === "yesterday") from = to = shift(today, -1);
  else if (range === "7d") from = shift(today, -6);
  else if (range === "30d") from = shift(today, -29);
  else if (range === "custom" && isValidDate(sp.from) && isValidDate(sp.to) && sp.from <= sp.to) {
    from = sp.from;
    to = sp.to;
  } else range = range === "custom" ? "today" : range;

  const r = await salesReport(tenant.id, from, to);
  const open = {
    n: (await ordersCreatedBetween(tenant.id, new Date(Date.now() - 3 * 86400000))).filter(
      (o) => o.status !== "cancelled" && o.paymentStatus === "unpaid",
    ).length,
  };

  const multiDay = from !== to;
  const days: string[] = [];
  for (let d = from; d <= to; d = shift(d, 1)) days.push(d);
  // Kedai day runs 6am to 6am (mamak hours).
  const hours = r.byHour.slice(6).concat(r.byHour.slice(0, 6));
  const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);
  const avg = r.orders ? Math.round(r.sales / r.orders) : 0;
  const collected = (r.byMethod.cash?.total ?? 0) + (r.byMethod.duitnow_qr?.total ?? 0);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={tenant.name}
        sub={multiDay ? `${from} to ${to}` : from === today ? "Today so far" : from}
        actions={
          <div className="flex flex-wrap gap-1 rounded-lg bg-surface p-1 ring-1 ring-line">
            {PRESETS.map((p) => (
              <Link
                key={p.key}
                href={`/app?range=${p.key}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold",
                  range === p.key ? "bg-ink text-on-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                {p.label}
              </Link>
            ))}
            <form className="flex items-center gap-1 pl-1">
              <input type="hidden" name="range" value="custom" />
              <input type="date" name="from" defaultValue={from} max={today} aria-label="From" className="h-8 rounded-md border border-line px-2 text-sm" />
              <input type="date" name="to" defaultValue={to} max={today} aria-label="To" className="h-8 rounded-md border border-line px-2 text-sm" />
              <button className="h-8 rounded-md px-2 text-sm font-semibold text-pandan">Go</button>
            </form>
          </div>
        }
      />

      {open?.n ? (
        <Link
          href="/app/pos"
          className="mb-5 flex items-center justify-between rounded-xl border-2 border-edge bg-tag px-4 py-3 text-sm font-bold text-[#141414]"
        >
          <span>
            {open.n} bill{open.n === 1 ? "" : "s"} still unpaid or waiting for confirmation
          </span>
          <span className="underline">Open counter</span>
        </Link>
      ) : null}

      <div className="mb-6 grid gap-0.5 overflow-hidden rounded-xl border-2 border-edge bg-edge sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-[#141414] p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-white/70">Sales</p>
          <p className="num font-display text-5xl text-tag">{rm(r.sales)}</p>
          <p className="mt-1 text-sm text-white/70">
            {r.orders} paid order{r.orders === 1 ? "" : "s"}
          </p>
        </div>
        <Stat label="Average bill" value={rm(avg)} />
        <Stat label="Money in hand" value={rm(collected)} sub={r.byMethod.credit ? `+ ${rm(r.byMethod.credit.total)} on credit` : "Cash and DuitNow QR"} />
        <Stat
          label="Discounts given"
          value={rm(r.discount)}
          sub={r.cancelled.n ? `${r.cancelled.n} cancelled (${rm(r.cancelled.total)})` : "No cancellations"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-display text-lg font-bold">{multiDay ? "Sales by day" : "Sales by hour"}</h2>
          {multiDay ? (
            <BarChart
              label="Sales by day"
              data={days.map((d) => {
                const row = r.byDay.find((x) => x.d === d);
                return { key: d, label: d.slice(8) + "/" + d.slice(5, 7), value: row?.total ?? 0, sub: `${row?.n ?? 0} orders` };
              })}
            />
          ) : (
            <BarChart
              label="Sales by hour"
              data={hours.map((h) => ({ key: String(h.h), label: hourLabel(h.h), value: h.total, sub: `${h.n} orders` }))}
            />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Payment method</h2>
          <Breakdown
            total={r.sales}
            rows={(["cash", "duitnow_qr", "credit"] as const).map((m) => ({
              label: METHOD_LABEL[m],
              value: r.byMethod[m]?.total ?? 0,
              n: r.byMethod[m]?.n ?? 0,
            }))}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Customer type</h2>
          <Breakdown
            total={r.sales}
            rows={(["walk_in", "member", "staff", "corporate"] as const).map((k) => ({
              label: CUSTOMER_TYPE_LABEL[k],
              value: r.byCustomer[k]?.total ?? 0,
              n: r.byCustomer[k]?.n ?? 0,
            }))}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Order type</h2>
          <Breakdown
            total={r.sales}
            rows={(["dine_in", "takeaway", "delivery"] as const).map((k) => ({
              label: ORDER_TYPE_LABEL[k],
              value: r.byType[k]?.total ?? 0,
              n: r.byType[k]?.n ?? 0,
            }))}
          />
          <h3 className="mb-3 mt-6 text-sm font-semibold text-ink-soft">Where orders came from</h3>
          <Breakdown
            total={r.sales}
            rows={[
              { label: "Customer scanned QR", value: r.bySource.qr?.total ?? 0, n: r.bySource.qr?.n ?? 0 },
              { label: "Keyed in at counter", value: r.bySource.counter?.total ?? 0, n: r.bySource.counter?.n ?? 0 },
            ]}
          />
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Best sellers</h2>
          {r.topItems.length === 0 ? (
            <p className="text-sm text-mute">No sales in this period.</p>
          ) : (
            <ol className="divide-y divide-line">
              {r.topItems.map((it, i) => (
                <li key={it.name} className="flex items-center gap-3 py-2 text-sm">
                  <span className="num w-5 text-mute">{i + 1}</span>
                  <span className="flex-1 font-medium">{it.name}</span>
                  <span className="num text-ink-soft">{it.qty} sold</span>
                  <span className="num w-24 text-right font-semibold">{rm(it.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Tax & charges collected</h2>
          <dl className="num space-y-2 text-sm">
            <Row k="Item sales (before discount)" v={r.subtotal} />
            <Row k="Discounts" v={-r.discount} />
            <Row k="Service charge" v={r.service} />
            <Row k="SST" v={r.sst} />
            <div className="flex justify-between border-t border-line pt-2 font-bold">
              <dt>Total sales</dt>
              <dd>{rm(r.sales)}</dd>
            </div>
          </dl>
          <Link href={`/app/recon?date=${to}`} className="mt-4 inline-block text-sm font-bold text-ink underline decoration-tag decoration-[3px] underline-offset-4">
            Reconcile {to === today ? "today" : to}
          </Link>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="num font-display text-4xl">{value}</p>
      {sub ? <p className="mt-1 text-sm text-mute">{sub}</p> : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between text-ink-soft">
      <dt>{k}</dt>
      <dd>{rm(v)}</dd>
    </div>
  );
}
