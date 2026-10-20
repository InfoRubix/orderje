import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadMenu } from "@/lib/orders";
import { rm } from "@/lib/money";
import { buttonVariants, Card, Empty, PageHeader } from "@/components/ui";
import { AvailableToggle, CategoryEditor, NewCategory } from "./client";

export const metadata = { title: "Menu" };

export default async function MenuPage() {
  const { tenant } = await requireUser(["owner"]);
  const menu = await loadMenu(tenant.id, { includeUnavailable: true });
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Menu"
        sub="Turn items off when they sell out. Customers stop seeing them right away."
        actions={
          menu.length ? (
            <Link href="/app/menu/new" className={buttonVariants()}>
              <Plus className="size-4" /> Add item
            </Link>
          ) : null
        }
      />
      <NewCategory />
      {menu.length === 0 ? (
        <Empty title="Start with a category">Add one above, like “Nasi”, “Roti” or “Minuman”, then add items to it.</Empty>
      ) : null}
      <div className="space-y-6">
        {menu.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            <CategoryEditor id={c.id} name={c.name} sort={c.sort} count={c.items.length} />
            {c.items.length === 0 ? (
              <p className="px-5 py-4 text-sm text-ink-soft">
                No items yet.{" "}
                <Link href={`/app/menu/new?category=${c.id}`} className="font-semibold text-pandan underline">
                  Add one
                </Link>
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {c.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/app/menu/${i.id}`} className="font-semibold hover:underline">
                        {i.name}
                      </Link>
                      <p className="text-sm text-ink-soft">
                        <span className="num">{rm(i.price)}</span>
                        {i.groups.length ? ` · ${i.groups.map((g) => g.name).join(", ")}` : ""}
                      </p>
                    </div>
                    <AvailableToggle id={i.id} available={i.available} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
