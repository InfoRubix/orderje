import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { diningTables, tenants } from "@/db/schema";
import { loadMenu } from "@/lib/orders";
import { CustomerMenu } from "./menu";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [t] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return { title: t ? `Menu · ${t.name}` : "Menu" };
}

export default async function TablePage({ params }: { params: Promise<{ slug: string; table: string }> }) {
  const { slug, table } = await params;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!tenant) notFound();

  let tableLabel: string | null = null;
  if (table !== "takeaway") {
    const [t] = await db
      .select()
      .from(diningTables)
      .where(and(eq(diningTables.token, table), eq(diningTables.tenantId, tenant.id)))
      .limit(1);
    if (!t || !t.active) notFound();
    tableLabel = t.label;
  }

  if (!tenant.active) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <p className="font-display text-xl font-semibold">{tenant.name} isn&apos;t taking QR orders right now.</p>
      </main>
    );
  }

  const menu = await loadMenu(tenant.id);
  return (
    <CustomerMenu
      slug={slug}
      table={table}
      tableLabel={tableLabel}
      shop={{ name: tenant.name, address: tenant.address }}
      menu={menu}
      rates={{
        sstRate: tenant.sstRate,
        serviceChargeRate: tenant.serviceChargeRate,
        memberDiscountRate: 0,
        staffDiscountRate: 0,
      }}
    />
  );
}
