import { requireUser } from "@/lib/auth";
import { listMenuItems } from "@/lib/orders";
import { buttonVariants, PageHeader } from "@/components/ui";
import { BrandForm } from "./form";

export const metadata = { title: "Brand & profile" };

export default async function BrandPage() {
  const { tenant } = await requireUser(["owner"]);
  const items = (await listMenuItems(tenant.id)).filter((i) => i.available).slice(0, 3);
  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Brand & profile"
        sub="How your kedai looks to customers on the QR menu, order page and receipts."
        actions={
          <a href={`/t/${tenant.slug}/takeaway`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "secondary" })}>
            See it on the customer phone
          </a>
        }
      />
      <BrandForm
        t={{
          name: tenant.name,
          tagline: tenant.tagline ?? "",
          address: tenant.address ?? "",
          phone: tenant.phone ?? "",
          receiptFooter: tenant.receiptFooter ?? "",
          brandColor: tenant.brandColor,
          logoUrl: tenant.logoUrl,
        }}
        sample={items.map((i) => ({ id: i.id, name: i.name, price: i.price, imageUrl: i.imageUrl }))}
      />
    </div>
  );
}
