import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { diningTables } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { loadMenu } from "@/lib/orders";
import { CounterOrder } from "./builder";

export const metadata = { title: "New order" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const { tenant } = await requireUser(["owner", "cashier"]);
  const { table } = await searchParams;
  const [menu, tables] = await Promise.all([
    loadMenu(tenant.id),
    db
      .select({ id: diningTables.id, label: diningTables.label })
      .from(diningTables)
      .where(and(eq(diningTables.tenantId, tenant.id), eq(diningTables.active, true)))
      .orderBy(asc(diningTables.sort)),
  ]);
  return (
    <CounterOrder
      menu={menu}
      tables={tables}
      defaultTable={table}
      rates={{ sstRate: tenant.sstRate, serviceChargeRate: tenant.serviceChargeRate, memberDiscountRate: 0, staffDiscountRate: 0 }}
    />
  );
}
