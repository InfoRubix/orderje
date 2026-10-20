import QRCode from "qrcode";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { diningTables } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { appUrl } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { AddTables, PrintButton, TableCard } from "./client";

export const metadata = { title: "Tables & QR" };

async function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1d2433", light: "#ffffff" } });
}

export default async function TablesPage() {
  const { tenant } = await requireUser(["owner"]);
  const tables = await db.select().from(diningTables).where(eq(diningTables.tenantId, tenant.id)).orderBy(asc(diningTables.sort));
  const base = `${appUrl()}/t/${tenant.slug}`;
  const cards = await Promise.all(
    tables.map(async (t) => ({ ...t, url: `${base}/${t.token}`, svg: await qrSvg(`${base}/${t.token}`) })),
  );
  const takeawayUrl = `${base}/takeaway`;
  const takeawaySvg = await qrSvg(takeawayUrl);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Tables & QR"
          sub="Print and stick one QR on each table. Orders arrive tagged with the table name."
          actions={<PrintButton />}
        />
        <AddTables />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 print:grid-cols-3 print:gap-6">
        <TableCard
          shop={tenant.name}
          label="Takeaway"
          url={takeawayUrl}
          svg={takeawaySvg}
          caption="Scan to order bungkus"
        />
        {cards.map((t) => (
          <TableCard
            key={t.id}
            id={t.id}
            shop={tenant.name}
            label={t.label}
            url={t.url}
            svg={t.svg}
            active={t.active}
            caption="Scan to order & pay"
          />
        ))}
      </div>
    </div>
  );
}
