import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listUsers, recentReconciliations } from "@/lib/repo";
import { reconSummary } from "@/lib/reports";
import { rm } from "@/lib/money";
import { fmtDateTime, fmtTime, isValidDate, myDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Badge, buttonVariants, Card, Input, PageHeader } from "@/components/ui";
import { CloseDayForm, ReopenButton } from "./client";

export const metadata = { title: "Recon" };
export const dynamic = "force-dynamic";

export default async function ReconPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { user, tenant } = await requireUser(["owner", "cashier"]);
  const sp = await searchParams;
  const today = myDate();
  const date = isValidDate(sp.date) && sp.date <= today ? sp.date : today;
  const s = await reconSummary(tenant.id, date);
  const [recs, staff] = await Promise.all([recentReconciliations(tenant.id, 14), listUsers(tenant.id)]);
  const names = new Map(staff.map((u) => [u.id, u.name]));
  const history = recs.map((r) => ({ r, by: names.get(r.closedBy) ?? null }));

  const expected = {
    cash: s.byMethod.cash + s.settlements.cash,
    qr: s.byMethod.duitnow_qr + s.settlements.duitnow_qr,
    online: s.byMethod.online,
  };
  const c = s.closed;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="End-of-day recon"
        sub="Check what the system recorded against your drawer, bank app and ToyyibPay."
        actions={
          <form className="flex gap-2">
            <Input type="date" name="date" defaultValue={date} max={today} aria-label="Business date" />
            <button className={buttonVariants({ variant: "secondary" })}>Show</button>
          </form>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="font-display text-lg font-bold">{date === today ? "Today" : date}</h2>
              {c ? <Badge tone="green">Closed</Badge> : <Badge tone="amber">Open</Badge>}
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-ink-soft">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 font-medium">Channel</th>
                  <th className="px-5 py-2 text-right font-medium">System</th>
                  <th className="px-5 py-2 text-right font-medium">{c ? "Actual" : "Count"}</th>
                  <th className="px-5 py-2 text-right font-medium">{c ? "Difference" : ""}</th>
                </tr>
              </thead>
              <tbody className="num divide-y divide-line">
                <Line
                  name="Cash"
                  sub={`${plural(s.countByMethod.cash, "bill")}${s.settlements.cash ? ` + ${rm(s.settlements.cash)} credit settled` : ""}`}
                  system={expected.cash}
                  actual={c ? c.countedCash - c.openingFloat : undefined}
                  actualNote={c?.openingFloat ? `drawer ${rm(c.countedCash)} − float ${rm(c.openingFloat)}` : undefined}
                />
                <Line
                  name="DuitNow QR"
                  sub={plural(s.countByMethod.duitnow_qr, "payment")}
                  system={expected.qr}
                  actual={c?.bankQr}
                />
                <Line name="Online (FPX)" sub={plural(s.countByMethod.online, "payment")} system={expected.online} actual={c?.gatewayOnline} />
                <tr className="text-ink-soft">
                  <td className="px-5 py-3">
                    Corporate credit
                    <p className="text-xs text-mute">{plural(s.countByMethod.credit, "bill")}, collected later</p>
                  </td>
                  <td className="px-5 py-3 text-right">{rm(s.byMethod.credit)}</td>
                  <td colSpan={2} className="px-5 py-3 text-right text-xs">Not counted in today&apos;s money</td>
                </tr>
                {s.settlements.online ? (
                  <tr className="text-ink-soft">
                    <td className="px-5 py-3">Credit settled by bank transfer</td>
                    <td className="px-5 py-3 text-right">{rm(s.settlements.online)}</td>
                    <td colSpan={2} className="px-5 py-3 text-right text-xs">Check in your bank statement</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {c ? (
              <div className="border-t border-line px-5 py-3 text-sm text-ink-soft">
                Closed {fmtDateTime(c.createdAt)} by {history.find((h) => h.r.id === c.id)?.by ?? "staff"}
                {c.notes ? <p className="mt-1 text-ink">Note: {c.notes}</p> : null}
              </div>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-3">
              <h2 className="font-display text-lg font-bold">QR & online payments to tick off</h2>
              <p className="text-sm text-ink-soft">Match each one against your bank app or ToyyibPay report.</p>
            </div>
            {s.electronic.length === 0 ? (
              <p className="px-5 py-4 text-sm text-mute">No QR or online payments on this day.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {s.electronic.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5">
                    <label className="flex flex-1 items-center gap-3">
                      <input type="checkbox" className="size-4 accent-pandan" aria-label={`Ticked ${p.reference ?? p.id}`} />
                      <span className="num w-16 text-ink-soft">{p.confirmedAt ? fmtTime(p.confirmedAt) : ""}</span>
                      <span className="font-medium">{p.method === "online" ? "FPX" : "QR"}</span>
                      <span className="text-ink-soft">
                        {p.kind === "settlement" ? "Credit settlement" : p.orderId ? `Order #${p.orderNo}` : ""}
                      </span>
                    </label>
                    <span className="num text-ink-soft">{p.reference ?? "no ref"}</span>
                    <span className="num w-24 text-right font-semibold">{rm(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {c ? (
            <Card className="space-y-3 p-5">
              <p className="font-display text-lg font-bold">This day is closed</p>
              <p className="text-sm text-ink-soft">To fix a mistake, the owner can reopen it, correct the orders, and close again.</p>
              {user.role === "owner" ? <ReopenButton date={date} /> : null}
            </Card>
          ) : s.openOrders > 0 ? (
            <Card className="space-y-3 border-teh/40 bg-teh-soft p-5">
              <p className="font-display text-lg font-bold text-teh">Can&apos;t close yet</p>
              <p className="text-sm">
                {s.openOrders} order{s.openOrders === 1 ? " is" : "s are"} unpaid or waiting for payment confirmation. Settle or
                cancel {s.openOrders === 1 ? "it" : "them"} first.
              </p>
              <Link href="/app/pos" className={buttonVariants({ variant: "amber" })}>
                Open counter
              </Link>
            </Card>
          ) : (
            <CloseDayForm date={date} expected={expected} />
          )}

          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg font-bold">Recent closings</h2>
            {history.length === 0 ? (
              <p className="text-sm text-mute">Nothing closed yet.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {history.map(({ r }) => {
                  const diff =
                    r.countedCash - r.openingFloat - r.expectedCash + (r.bankQr - r.expectedQr) + (r.gatewayOnline - r.expectedOnline);
                  return (
                    <li key={r.id}>
                      <Link href={`/app/recon?date=${r.businessDate}`} className="flex justify-between py-2 hover:underline">
                        <span className="num">{r.businessDate}</span>
                        <span className={cn("num font-semibold", diff < 0 ? "text-chili" : diff > 0 ? "text-teh" : "text-pandan")}>
                          {diff === 0 ? "Balanced" : `${diff > 0 ? "+" : ""}${rm(diff)}`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Line({
  name,
  sub,
  system,
  actual,
  actualNote,
}: {
  name: string;
  sub: string;
  system: number;
  actual?: number;
  actualNote?: string;
}) {
  const diff = actual === undefined ? undefined : actual - system;
  return (
    <tr>
      <td className="px-5 py-3">
        <span className="font-semibold">{name}</span>
        <p className="text-xs text-mute">{sub}</p>
      </td>
      <td className="px-5 py-3 text-right font-semibold">{rm(system)}</td>
      <td className="px-5 py-3 text-right">
        {actual === undefined ? <span className="text-mute">—</span> : rm(actual)}
        {actualNote ? <p className="text-xs text-mute">{actualNote}</p> : null}
      </td>
      <td className={cn("px-5 py-3 text-right font-semibold", diff === undefined ? "" : diff < 0 ? "text-chili" : diff > 0 ? "text-teh" : "text-pandan")}>
        {diff === undefined ? "" : diff === 0 ? "Match" : `${diff > 0 ? "+" : ""}${rm(diff)}`}
      </td>
    </tr>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
