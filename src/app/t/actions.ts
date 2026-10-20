"use server";

import { z } from "zod";
import { createOrder, OrderError } from "@/lib/orders";
import { getTableByToken, getTenantBySlug } from "@/lib/repo";

const schema = z.object({
  slug: z.string().min(1).max(64),
  table: z.string().min(1).max(32),
  orderType: z.enum(["dine_in", "takeaway"]),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(32).optional(),
  note: z.string().max(255).optional(),
  lines: z
    .array(
      z.object({
        menuItemId: z.string().max(36),
        qty: z.number().int().min(1).max(99),
        optionIds: z.array(z.string().max(36)).max(20),
        note: z.string().max(160).optional(),
      }),
    )
    .min(1)
    .max(100),
});

export async function placeQrOrder(input: z.infer<typeof schema>): Promise<{ token?: string; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Something in the cart looks wrong. Refresh and try again." };
  const d = parsed.data;
  const tenant = await getTenantBySlug(d.slug);
  if (!tenant) return { error: "Kedai not found." };

  let tableId: string | null = null;
  if (d.table !== "takeaway") {
    const t = await getTableByToken(tenant.id, d.table);
    if (!t) return { error: "This table QR is not recognised. Ask the counter." };
    tableId = t.id;
  }
  if (d.orderType === "takeaway" && !d.customerName?.trim())
    return { error: "Add your name so we can call you when it's ready." };

  try {
    const o = await createOrder({
      tenantId: tenant.id,
      source: "qr",
      orderType: tableId ? d.orderType : "takeaway",
      tableId,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      note: d.note,
      lines: d.lines,
    });
    return { token: o.publicToken };
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    console.error(e);
    return { error: "Couldn't send the order. Try again or order at the counter." };
  }
}
