import Link from "next/link";
import type { RegisteredCustomerType } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { makeT } from "@/lib/i18n";
import { outstandingCredit } from "@/lib/orders";
import { listCustomers } from "@/lib/repo";
import { pct, rm } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card, Empty, PageHeader } from "@/components/ui";
import { CustomerForm, CustomerRow } from "./client";

export const metadata = { title: "Customers" };

const TABS: { key: RegisteredCustomerType; label: string; add: string; none: string }[] = [
  { key: "member", label: "Members", add: "Add member", none: "No members yet" },
  { key: "staff", label: "Staff", add: "Add staff", none: "No staff yet" },
  { key: "corporate", label: "Corporate", add: "Add corporate", none: "No corporate yet" },
];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { tenant } = await requireUser(["owner", "cashier"]);
  const t = makeT(tenant.language);
  const sp = await searchParams;
  const type = (TABS.find((x) => x.key === sp.type)?.key ?? "member") as RegisteredCustomerType;
  const tab = TABS.find((x) => x.key === type)!;
  const list = await listCustomers(tenant.id, { type });
  const owing = type === "corporate" ? await Promise.all(list.map((c) => outstandingCredit(tenant.id, c.id))) : [];

  const blurb = {
    member: t("Members get {pct} off.", { pct: pct(tenant.memberDiscountRate) }),
    staff: t("Staff meals get {pct} off.", { pct: pct(tenant.staffDiscountRate) }),
    corporate: t("Companies eat now and pay monthly. Bills go on their account until settled."),
  }[type];

  return (
    <div className="max-w-4xl">
      <PageHeader title={t("Customers")} sub={`${blurb} ${t("Pick the customer type on the payment screen.")}`} />
      <div className="mb-5 flex gap-1 rounded-lg bg-surface p-1 ring-1 ring-line sm:w-fit">
        {TABS.map((x) => (
          <Link
            key={x.key}
            href={`/app/customers?type=${x.key}`}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-center text-sm font-semibold",
              type === x.key ? "bg-ink text-on-ink" : "text-ink-soft hover:text-ink",
            )}
          >
            {t(x.label)}
          </Link>
        ))}
      </div>
      <Card className="mb-6 p-5">
        <h2 className="mb-3 font-display text-lg font-bold">{t(tab.add)}</h2>
        <CustomerForm type={type} />
      </Card>
      {list.length === 0 ? (
        <Empty title={t(tab.none)} />
      ) : (
        <Card className="divide-y divide-line">
          {list.map((c, i) => (
            <CustomerRow
              key={c.id}
              c={{ ...c, creditLimitRm: (c.creditLimit / 100).toFixed(2) }}
              owing={type === "corporate" ? owing[i] : undefined}
              owingLabel={type === "corporate" ? rm(owing[i]) : undefined}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
