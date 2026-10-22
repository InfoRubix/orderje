import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ordersCreatedBetween } from "@/lib/repo";
import { rm } from "@/lib/money";
import { CUSTOMER_TYPE_LABEL, ORDER_TYPE_LABEL } from "@/lib/pricing";
import { dayRange, fmtTime, isValidDate, myDate } from "@/lib/time";
import { makeT } from "@/lib/i18n";
import { Badge, buttonVariants, Empty, Input, PageHeader } from "@/components/ui";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const PAY_TONE = { paid: "green", credit: "green", unpaid: "red" } as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { tenant } = await requireUser(["owner", "cashier"]);
  const t = makeT(tenant.language);
  const sp = await searchParams;
  const date = isValidDate(sp.date) ? sp.date : myDate();
  const { start, end } = dayRange(date);
  const list = await ordersCreatedBetween(tenant.id, start, end);

  return (
    <div>
      <PageHeader
        title={t("Orders")}
        sub={t("{n} order(s) placed on {date}", { n: list.length, date })}
        actions={
          <form className="flex gap-2">
            <Input type="date" name="date" defaultValue={date} max={myDate()} aria-label={t("Date")} />
            <button className={buttonVariants({ variant: "secondary" })}>{t("Show")}</button>
          </form>
        }
      />
      {list.length === 0 ? (
        <Empty title={t("No orders on this day")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border-2 border-edge bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left text-ink-soft">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">{t("Time")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Where")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Customer")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Source")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Status")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Payment")}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t("Total")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((o) => (
                <tr key={o.id} className="hover:bg-paper">
                  <td className="num px-4 py-2.5 font-semibold">
                    <Link href={`/app/orders/${o.id}`} className="hover:underline">
                      {o.orderNo}
                    </Link>
                  </td>
                  <td className="num px-4 py-2.5">{fmtTime(o.createdAt, tenant.language)}</td>
                  <td className="px-4 py-2.5">{o.tableLabel ?? t(ORDER_TYPE_LABEL[o.orderType])}</td>
                  <td className="px-4 py-2.5">
                    {t(CUSTOMER_TYPE_LABEL[o.customerType])}
                    {o.customerName ? <span className="text-ink-soft"> · {o.customerName}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 uppercase text-ink-soft">{t(o.source)}</td>
                  <td className="px-4 py-2.5 capitalize">{t(o.status)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={o.status === "cancelled" ? "neutral" : PAY_TONE[o.paymentStatus]}>
                      {o.status === "cancelled" ? "—" : o.paymentStatus === "credit" ? t("on credit") : t(o.paymentStatus)}
                    </Badge>
                  </td>
                  <td className="num px-4 py-2.5 text-right font-semibold">{rm(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
