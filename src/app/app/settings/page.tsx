import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { makeT } from "@/lib/i18n";
import { appUrl } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { tenant } = await requireUser(["owner"]);
  const r = (bp: number) => String(bp / 100);
  const t = makeT(tenant.language);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t("Settings")}
        sub={t("Language, tax, service charge and discounts. Customer menu link: {url}", { url: `${appUrl()}/t/${tenant.slug}/…` })}
      />
      <p className="mb-5 text-sm text-ink-soft">
        {t("Kedai name, logo, colour and receipt message are under")}{" "}
        <Link href="/app/brand" className="font-bold text-ink underline decoration-tag decoration-[3px] underline-offset-4">
          {t("Brand & profile")}
        </Link>
        .
      </p>
      <SettingsForm
        v={{
          language: tenant.language,
          email: tenant.email ?? "",
          sstRate: r(tenant.sstRate),
          serviceChargeRate: r(tenant.serviceChargeRate),
          memberDiscountRate: r(tenant.memberDiscountRate),
          staffDiscountRate: r(tenant.staffDiscountRate),
        }}
      />
    </div>
  );
}
