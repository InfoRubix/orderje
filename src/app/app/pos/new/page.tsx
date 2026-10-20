import { requireUser } from "@/lib/auth";
import { loadMenu } from "@/lib/orders";
import { listTables } from "@/lib/repo";
import { CounterOrder } from "./builder";

export const metadata = { title: "New order" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const { tenant } = await requireUser(["owner", "cashier"]);
  const { table } = await searchParams;
  const [menu, tables] = await Promise.all([
    loadMenu(tenant.id),
    listTables(tenant.id, { activeOnly: true }).then((ts) => ts.map((t) => ({ id: t.id, label: t.label }))),
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
