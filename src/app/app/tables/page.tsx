import QRCode from "qrcode";
import { listTables } from "@/lib/repo";
import { requireUser } from "@/lib/auth";
import { makeT } from "@/lib/i18n";
import { appUrl } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { AddTables, PrintButton, TableCard } from "./client";

export const metadata = { title: "Tables & QR" };

async function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1d2433", light: "#ffffff" } });
}

export default async function TablesPage() {
  const { tenant } = await requireUser(["owner"]);
  const t = makeT(tenant.language);
  const tables = await listTables(tenant.id);
  const base = `${appUrl()}/t/${tenant.slug}`;
  const cards = await Promise.all(
    tables.map(async (tb) => ({ ...tb, url: `${base}/${tb.token}`, svg: await qrSvg(`${base}/${tb.token}`) })),
  );
  const takeawayUrl = `${base}/takeaway`;
  const takeawaySvg = await qrSvg(takeawayUrl);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={t("Tables & QR")}
          sub={t("Print and stick one QR on each table. Orders arrive tagged with the table name.")}
          actions={<PrintButton />}
        />
        <AddTables />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 print:grid-cols-3 print:gap-6">
        <TableCard
          shop={tenant.name}
          color={tenant.brandColor}
          label={t("Takeaway")}
          url={takeawayUrl}
          svg={takeawaySvg}
          caption={t("Scan to order bungkus")}
        />
        {cards.map((tb) => (
          <TableCard
            key={tb.id}
            id={tb.id}
            shop={tenant.name}
            color={tenant.brandColor}
            label={tb.label}
            url={tb.url}
            svg={tb.svg}
            active={tb.active}
            caption={t("Scan to order & pay")}
          />
        ))}
      </div>
    </div>
  );
}
