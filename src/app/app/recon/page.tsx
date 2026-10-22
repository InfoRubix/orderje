import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listUsers, recentReconciliations } from "@/lib/repo";
import { reconSummary } from "@/lib/reports";
import { rm } from "@/lib/money";
import { fmtDateTime, fmtTime, isValidDate, myDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { makeT, type T } from "@/lib/i18n";
import { Badge, buttonVariants, Card, Input, PageHeader } from "@/components/ui";
import { CloseDayForm, ReopenButton } from "./client";

export const metadata = { title: "Recon" };
export const dynamic = "force-dynamic";

export default async function ReconPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { user, tenant } = await requireUser(["owner", "cashier"]);
  const t = makeT(tenant.language);
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
  };
  const c = s.closed;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t("End-of-day recon")}
        sub={t("Check what the system recorded against your cash drawer and bank app.")}
        actions={
          <form className="flex gap-2">
            <Input type="date" name="date" defaultValue={date} max={today} aria-label={t("Business date")} />
            <button className={buttonVariants({ variant: "secondary" })}>{t("Show")}</button>
          </form>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="font-display text-lg font-bold">{date === today ? t("Today") : date}</h2>
              {c ? <Badge tone="green">{t("Closed")}</Badge> : <Badge tone="amber">{t("Open")}</Badge>}
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-ink-soft">
                <tr className="border-b border-line">
                  <th className="px-5 py-2 font-medium">{t("Channel")}</th>
                  <th className="px-5 py-2 text-right font-medium">{t("System")}</th>
                  <th className="px-5 py-2 text-right font-medium">{c ? t("Actual") : t("Count")}</th>
                  <th className="px-5 py-2 text-right font-medium">{c ? t("Difference") : ""}</th>
                </tr>
              </thead>
              <tbody className="num divide-y divide-line">
                <Line
                  t={t}
                  name={t("Cash")}
                  sub={`${plural(t, s.countByMethod.cash, "bill")}${s.settlements.cash ? ` + ${t("{amount} credit settled", { amount: rm(s.settlements.cash) })}` : ""}`}
                  system={expected.cash}
                  actual={c ? c.countedCash - c.openingFloat : undefined}
                  actualNote={c?.openingFloat ? t("drawer {counted} − float {float}", { counted: rm(c.countedCash), float: rm(c.openingFloat) }) : undefined}
                />
                <Line
                  t={t}
                  name={t("DuitNow QR")}
                  sub={`${plural(t, s.countByMethod.duitnow_qr, "payment")}${s.settlements.duitnow_qr ? ` + ${t("{amount} credit settled", { amount: rm(s.settlements.duitnow_qr) })}` : ""}`}
                  system={expected.qr}
                  actual={c?.bankQr}
                />
                <tr className="text-ink-soft">
                  <td className="px-5 py-3">
                    {t("Corporate credit")}
                    <p className="text-xs text-mute">{t("{bills}, collected later", { bills: plural(t, s.countByMethod.credit, "bill") })}</p>
                  </td>
                  <td className="px-5 py-3 text-right">{rm(s.byMethod.credit)}</td>
                  <td colSpan={2} className="px-5 py-3 text-right text-xs">{t("Not counted in today's money")}</td>
                </tr>
              </tbody>
            </table>
            {c ? (
              <div className="border-t border-line px-5 py-3 text-sm text-ink-soft">
                {t("Closed {when} by {name}", {
                  when: fmtDateTime(c.createdAt, tenant.language),
                  name: history.find((h) => h.r.id === c.id)?.by ?? t("staff"),
                })}
                {c.notes ? <p className="mt-1 text-ink">{t("Note: {note}", { note: c.notes })}</p> : null}
              </div>
            ) : null}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-3">
              <h2 className="font-display text-lg font-bold">{t("DuitNow QR payments to tick off")}</h2>
              <p className="text-sm text-ink-soft">{t("Match each one against your bank app.")}</p>
            </div>
            {s.electronic.length === 0 ? (
              <p className="px-5 py-4 text-sm text-mute">{t("No DuitNow QR payments on this day.")}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {s.electronic.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5">
                    <label className="flex flex-1 items-center gap-3">
                      <input type="checkbox" className="size-4 accent-pandan" aria-label={t("Ticked {ref}", { ref: p.reference ?? p.id })} />
                      <span className="num w-16 text-ink-soft">{p.confirmedAt ? fmtTime(p.confirmedAt, tenant.language) : ""}</span>
                      <span className="font-medium">QR</span>
                      <span className="text-ink-soft">
                        {p.kind === "settlement" ? t("Credit settlement") : p.orderId ? t("Order #{n}", { n: p.orderNo ?? "" }) : ""}
                      </span>
                    </label>
                    <span className="num text-ink-soft">{p.reference ?? t("no ref")}</span>
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
              <p className="font-display text-lg font-bold">{t("This day is closed")}</p>
              <p className="text-sm text-ink-soft">{t("To fix a mistake, the owner can reopen it, correct the orders, and close again.")}</p>
              {user.role === "owner" ? <ReopenButton date={date} /> : null}
            </Card>
          ) : s.openOrders > 0 ? (
            <Card className="space-y-3 border-teh/40 bg-teh-soft p-5">
              <p className="font-display text-lg font-bold text-teh">{t("Can't close yet")}</p>
              <p className="text-sm">
                {t(
                  s.openOrders === 1
                    ? "{n} order is still unpaid ({nos}). Settle or cancel it first."
                    : "{n} orders are still unpaid ({nos}). Settle or cancel them first.",
                  { n: s.openOrders, nos: s.openOrderNos.map((n) => `#${n}`).join(", ") },
                )}
              </p>
              <Link href="/app/pos" className={buttonVariants({ variant: "amber" })}>
                {t("Open counter")}
              </Link>
            </Card>
          ) : (
            <CloseDayForm date={date} expected={expected} />
          )}

          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg font-bold">{t("Recent closings")}</h2>
            {history.length === 0 ? (
              <p className="text-sm text-mute">{t("Nothing closed yet.")}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {history.map(({ r }) => {
                  const diff =
                    r.countedCash - r.openingFloat - r.expectedCash + (r.bankQr - r.expectedQr);
                  return (
                    <li key={r.id}>
                      <Link href={`/app/recon?date=${r.businessDate}`} className="flex justify-between py-2 hover:underline">
                        <span className="num">{r.businessDate}</span>
                        <span className={cn("num font-semibold", diff < 0 ? "text-chili" : diff > 0 ? "text-teh" : "text-pandan")}>
                          {diff === 0 ? t("Balanced") : `${diff > 0 ? "+" : ""}${rm(diff)}`}
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
  t,
  name,
  sub,
  system,
  actual,
  actualNote,
}: {
  t: T;
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
        {diff === undefined ? "" : diff === 0 ? t("Match") : `${diff > 0 ? "+" : ""}${rm(diff)}`}
      </td>
    </tr>
  );
}

function plural(t: T, n: number, word: string) {
  return t(n === 1 ? `{n} ${word}` : `{n} ${word}s`, { n });
}
