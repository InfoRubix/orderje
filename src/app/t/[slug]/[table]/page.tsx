import { notFound } from "next/navigation";
import { makeT } from "@/lib/i18n";
import { loadMenu } from "@/lib/orders";
import { getTableByToken, getTenantBySlug } from "@/lib/repo";
import { I18nProvider } from "@/components/i18n";
import { CustomerMenu } from "./menu";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTenantBySlug(slug);
  return { title: t ? `${makeT(t.language)("Menu")} · ${t.name}` : "Menu" };
}

export default async function TablePage({ params }: { params: Promise<{ slug: string; table: string }> }) {
  const { slug, table } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  const tr = makeT(tenant.language);

  let tableLabel: string | null = null;
  if (table !== "takeaway") {
    const t = await getTableByToken(tenant.id, table);
    if (!t || !t.active) notFound();
    tableLabel = t.label;
  }

  if (!tenant.active) {
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center" lang={tenant.language}>
        <p className="font-display text-xl font-semibold">
          {tr("{name} isn't taking QR orders right now.", { name: tenant.name })}
        </p>
      </main>
    );
  }

  const menu = await loadMenu(tenant.id);
  return (
    <I18nProvider lang={tenant.language}>
      <CustomerMenu
        slug={slug}
        table={table}
        tableLabel={tableLabel}
        shop={{
          name: tenant.name,
          tagline: tenant.tagline,
          address: tenant.address,
          logoUrl: tenant.logoUrl,
          brandColor: tenant.brandColor,
        }}
        menu={menu}
        rates={{
          sstRate: tenant.sstRate,
          serviceChargeRate: tenant.serviceChargeRate,
          memberDiscountRate: 0,
          staffDiscountRate: 0,
        }}
      />
    </I18nProvider>
  );
}
