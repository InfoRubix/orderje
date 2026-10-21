import "server-only";
import { col, fs } from "@/db";
import type { MenuItem } from "@/db/schema";
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
  const batch = fs().batch();
  SAMPLE.forEach((cat, cSort) => {
    const categoryId = uid();
    batch.create(col.of(tenantId, "categories").doc(categoryId), { tenantId, name: cat.category, sort: cSort });
    cat.items.forEach((it, iSort) => {
      const menuItemId = uid();
      const item: Omit<MenuItem, "id"> = {
        tenantId,
        categoryId,
        name: it.name,
        description: it.desc ?? null,
        price: it.price,
        imageUrl: null,
        imagePath: null,
        available: true,
        sort: iSort,
        groups: (it.groups ?? []).map((g, gSort) => {
          const groupId = uid();
          return {
            id: groupId,
            menuItemId,
            name: g.name,
            required: g.required,
            maxSelect: g.max,
            sort: gSort,
            options: g.options.map(([name, price], i) => ({ id: uid(), groupId, name, price, sort: i })),
          };
        }),
      };
      batch.create(col.of(tenantId, "menuItems").doc(menuItemId), item);
    });
  });
  await batch.commit();
}

export async function seedTables(tenantId: string, count: number, startAt = 1, prefix = "Meja") {
  if (count <= 0) return;
  const batch = fs().batch();
  for (let i = 0; i < count; i++) {
    batch.create(col.of(tenantId, "tables").doc(uid()), {
      tenantId,
      label: `${prefix} ${startAt + i}`.slice(0, 40),
      token: token(12),
      active: true,
      sort: startAt + i,
    });
  }
  await batch.commit();
}
