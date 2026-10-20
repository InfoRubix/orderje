import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { loadMenu } from "@/lib/orders";
import { listCategories } from "@/lib/repo";
import { Card, Empty } from "@/components/ui";
import { ItemForm, ModifierEditor } from "./forms";

export default async function MenuItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { id } = await params;
  const { category } = await searchParams;
  const { tenant } = await requireUser(["owner"]);
  const cats = (await listCategories(tenant.id)).map((c) => ({ id: c.id, name: c.name }));

  const item =
    id === "new"
      ? null
      : (await loadMenu(tenant.id, { includeUnavailable: true })).flatMap((c) => c.items).find((i) => i.id === id);
  if (id !== "new" && !item) notFound();

  return (
    <div className="max-w-3xl">
      <Link href="/app/menu" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" /> Menu
      </Link>
      <h1 className="mb-6 font-display text-3xl font-bold">{item ? item.name : "New item"}</h1>
      {cats.length === 0 ? (
        <Empty title="Add a category first">
          <Link href="/app/menu" className="font-semibold text-pandan underline">
            Go to Menu
          </Link>
        </Empty>
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <ItemForm
              categories={cats}
              item={
                item
                  ? {
                      id: item.id,
                      name: item.name,
                      price: (item.price / 100).toFixed(2),
                      description: item.description ?? "",
                      imageUrl: item.imageUrl ?? "",
                      categoryId: item.categoryId,
                      available: item.available,
                    }
                  : { categoryId: cats.find((c) => c.id === category)?.id ?? cats[0].id }
              }
            />
          </Card>
          {item ? (
            <Card className="p-5">
              <h2 className="font-display text-xl font-bold">Add-ons & choices</h2>
              <p className="mb-4 text-sm text-ink-soft">
                Like “Panas / Ais” (required, pick 1) or “Lauk tambah” (optional, pick up to 3).
              </p>
              <ModifierEditor
                menuItemId={item.id}
                initial={item.groups.map((g) => ({
                  name: g.name,
                  required: g.required,
                  maxSelect: g.maxSelect,
                  options: g.options.map((o) => ({ name: o.name, price: o.price ? (o.price / 100).toFixed(2) : "" })),
                }))}
              />
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
