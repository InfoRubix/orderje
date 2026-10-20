import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, type RegisteredCustomerType } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { outstandingCredit } from "@/lib/orders";
import { pct, rm } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Card, Empty, PageHeader } from "@/components/ui";
import { CustomerForm, CustomerRow } from "./client";

export const metadata = { title: "Customers" };

const TABS: { key: RegisteredCustomerType; label: string }[] = [
  { key: "member", label: "Members" },
  { key: "staff", label: "Staff" },
  { key: "corporate", label: "Corporate" },
];

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { tenant } = await requireUser(["owner", "cashier"]);
  const sp = await searchParams;
  const type = (TABS.find((t) => t.key === sp.type)?.key ?? "member") as RegisteredCustomerType;
  const list = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenant.id), eq(customers.type, type)))
    .orderBy(asc(customers.name));
  const owing = type === "corporate" ? await Promise.all(list.map((c) => outstandingCredit(tenant.id, c.id))) : [];

  const blurb = {
    member: `Members get ${pct(tenant.memberDiscountRate)} off.`,
    staff: `Staff meals get ${pct(tenant.staffDiscountRate)} off.`,
    corporate: "Companies eat now and pay monthly. Bills go on their account until settled.",
  }[type];

  return (
    <div className="max-w-4xl">
      <PageHeader title="Customers" sub={`${blurb} Pick the customer type on the payment screen.`} />
      <div className="mb-5 flex gap-1 rounded-lg bg-surface p-1 ring-1 ring-line sm:w-fit">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/customers?type=${t.key}`}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-center text-sm font-semibold",
              type === t.key ? "bg-ink text-white" : "text-ink-soft hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Card className="mb-6 p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Add {TABS.find((t) => t.key === type)!.label.toLowerCase().replace(/s$/, "")}</h2>
        <CustomerForm type={type} />
      </Card>
      {list.length === 0 ? (
        <Empty title={`No ${TABS.find((t) => t.key === type)!.label.toLowerCase()} yet`} />
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
