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
      <PageHeader title="Settings" sub={`Customer menu link: ${appUrl()}/t/${tenant.slug}/…`} />
      <SettingsForm
        t={{
          name: tenant.name,
          address: tenant.address ?? "",
          phone: tenant.phone ?? "",
          email: tenant.email ?? "",
          receiptFooter: tenant.receiptFooter ?? "",
          sstRate: r(tenant.sstRate),
          serviceChargeRate: r(tenant.serviceChargeRate),
          memberDiscountRate: r(tenant.memberDiscountRate),
          staffDiscountRate: r(tenant.staffDiscountRate),
          allowQrCounterPay: tenant.allowQrCounterPay,
          duitnowQrUrl: tenant.duitnowQrUrl,
          toyyibpayCategory: tenant.toyyibpayCategory ?? "",
          hasToyyibpaySecret: Boolean(tenant.toyyibpaySecret),
          toyyibpaySandbox: tenant.toyyibpaySandbox,
        }}
        callbackUrl={`${appUrl()}/api/pay/toyyibpay/callback`}
      />
    </div>
  );
}
