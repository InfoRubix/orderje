import "server-only";
import { db } from "@/db";
import { categories, diningTables, menuItems, modifierGroups, modifierOptions } from "@/db/schema";
import { token, uid } from "./utils";

type SeedItem = { name: string; price: number; desc?: string; groups?: { name: string; required: boolean; max: number; options: [string, number][] }[] };

const SAMPLE: { category: string; items: SeedItem[] }[] = [
  {
    category: "Nasi & Mee",
    items: [
      {
        name: "Nasi Lemak Biasa",
        price: 350,
        desc: "Sambal, ikan bilis, kacang, timun",
        groups: [
          { name: "Lauk tambah", required: false, max: 3, options: [["Telur mata", 150], ["Ayam goreng", 450], ["Sotong", 400]] },
        ],
      },
      { name: "Nasi Goreng Kampung", price: 750 },
      {
        name: "Mee Goreng Mamak",
        price: 700,
        groups: [{ name: "Pedas", required: true, max: 1, options: [["Kurang pedas", 0], ["Biasa", 0], ["Extra pedas", 0]] }],
      },
      { name: "Maggi Goreng", price: 650, groups: [{ name: "Telur", required: false, max: 1, options: [["Telur mata", 150]] }] },
    ],
  },
  {
    category: "Roti",
    items: [
      { name: "Roti Canai", price: 150 },
      { name: "Roti Telur", price: 250 },
      { name: "Roti Bawang", price: 250 },
      { name: "Tosai", price: 200 },
    ],
  },
  {
    category: "Minuman",
    items: [
      {
        name: "Teh Tarik",
        price: 250,
        groups: [
          { name: "Panas / Ais", required: true, max: 1, options: [["Panas", 0], ["Ais", 50]] },
          { name: "Manis", required: false, max: 1, options: [["Kurang manis", 0], ["Kosong", 0]] },
        ],
      },
      { name: "Kopi O", price: 200, groups: [{ name: "Panas / Ais", required: true, max: 1, options: [["Panas", 0], ["Ais", 50]] }] },
      { name: "Milo", price: 300, groups: [{ name: "Panas / Ais", required: true, max: 1, options: [["Panas", 0], ["Ais", 50]] }] },
      { name: "Sirap Bandung", price: 300 },
      { name: "Limau Ais", price: 250 },
    ],
  },
];

export async function seedSampleMenu(tenantId: string) {
  let cSort = 0;
  for (const cat of SAMPLE) {
    const categoryId = uid();
    await db.insert(categories).values({ id: categoryId, tenantId, name: cat.category, sort: cSort++ });
    let iSort = 0;
    for (const it of cat.items) {
      const menuItemId = uid();
      await db.insert(menuItems).values({
        id: menuItemId,
        tenantId,
        categoryId,
        name: it.name,
        description: it.desc ?? null,
        price: it.price,
        sort: iSort++,
      });
      let gSort = 0;
      for (const g of it.groups ?? []) {
        const groupId = uid();
        await db.insert(modifierGroups).values({
          id: groupId,
          tenantId,
          menuItemId,
          name: g.name,
          required: g.required,
          maxSelect: g.max,
          sort: gSort++,
        });
        await db.insert(modifierOptions).values(
          g.options.map(([name, price], i) => ({ id: uid(), tenantId, groupId, name, price, sort: i })),
        );
      }
    }
  }
}

export async function seedTables(tenantId: string, count: number) {
  if (count <= 0) return;
  await db.insert(diningTables).values(
    Array.from({ length: count }, (_, i) => ({
      id: uid(),
      tenantId,
      label: `Meja ${i + 1}`,
      token: token(12),
      sort: i,
    })),
  );
}
