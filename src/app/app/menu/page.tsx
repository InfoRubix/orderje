import { requireUser } from "@/lib/auth";
import { loadMenu } from "@/lib/orders";
import { MenuEditor, type EditorCategory } from "./client";

export const metadata = { title: "Menu" };

export default async function MenuPage() {
  const { tenant } = await requireUser(["owner"]);
  const menu = await loadMenu(tenant.id, { includeUnavailable: true });
  const categories: EditorCategory[] = menu.map((c) => ({
    id: c.id,
    name: c.name,
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      description: i.description,
      imageUrl: i.imageUrl,
      available: i.available,
      categoryId: i.categoryId,
      groups: i.groups.map((g) => ({
        name: g.name,
        required: g.required,
        maxSelect: g.maxSelect,
        options: g.options.map((o) => ({ name: o.name, price: o.price })),
      })),
    })),
  }));
  return <MenuEditor categories={categories} />;
}
