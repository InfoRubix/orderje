import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { appUrl } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { tenant } = await requireUser(["owner"]);
  const r = (bp: number) => String(bp / 100);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        sub={`Tax, service charge and discounts. Customer menu link: ${appUrl()}/t/${tenant.slug}/…`}
      />
      <p className="mb-5 text-sm text-ink-soft">
        Kedai name, logo, colour and receipt message are under{" "}
        <Link href="/app/brand" className="font-semibold text-pandan-dark underline">
          Brand &amp; profile
        </Link>
        .
      </p>
      <SettingsForm
        t={{
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
