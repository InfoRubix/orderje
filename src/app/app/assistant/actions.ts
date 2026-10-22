"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { col, fs, read } from "@/db";
import type { MenuItem, ModifierGroup } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { askMenuAssistant, type ChatTurn } from "@/lib/ai";
import { deleteImage, getImage, putImage, putImageBytes } from "@/lib/images";
import { toSen } from "@/lib/money";
import { OrderError } from "@/lib/orders";
import { makeT, translate, UserError, type Lang } from "@/lib/i18n";
import { listCategories } from "@/lib/repo";
import { uid } from "@/lib/utils";

type Result<T> = ({ ok: true } & T) | { ok?: false; error: string };

function fail(e: unknown, lang: Lang): { error: string } {
  if (e instanceof UserError) return { error: e.in(lang) };
  if (e instanceof z.ZodError) return { error: translate(lang, e.issues[0]?.message ?? "Check the draft.") };
  unstable_rethrow(e);
  console.error(e);
  return { error: translate(lang, "Something went wrong and nothing was saved. Please try again.") };
}

/* ------------------------------------------------------------------ draft shape */

const BoxS = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const DraftChangeS = z.object({
  key: z.string(),
  op: z.enum(["add", "update", "remove"]),
  itemId: z.string().nullable(),
  name: z.string().trim().min(1, "Every item needs a name.").max(120),
  price: z.string(),
  description: z.string().max(255),
  category: z.string().max(40),
  available: z.boolean().nullable(),
  groups: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Every choice group needs a name.").max(80),
        required: z.boolean(),
        maxSelect: z.number().int().min(1).max(20),
        options: z.array(z.object({ name: z.string().trim().min(1).max(80), price: z.string() })).min(1).max(30),
      }),
    )
    .max(10)
    .nullable(),
  photo: z.object({ imageId: z.string(), box: BoxS }).nullable(),
});
const DraftS = z.object({ newCategories: z.array(z.string().trim().min(1).max(40)), changes: z.array(DraftChangeS).max(80) });
export type DraftChange = z.infer<typeof DraftChangeS>;
export type Draft = z.infer<typeof DraftS>;

const rm = (n: number | null) => (n === null || n === undefined ? "" : n.toFixed(2));

/* ------------------------------------------------------------------ actions */

/** Stores a poster or food photo (already shrunk in the browser) for the assistant to read. */
export async function uploadAssistantImage(f: FormData): Promise<Result<{ id: string; url: string }>> {
  const { tenant } = await requireUser(["owner"]);
  const t = makeT(tenant.language);
  try {
    const file = f.get("image");
    if (!(file instanceof File) || !file.size) return { error: t("Choose an image first.") };
    const up = await putImage(tenant.id, file, "ai-source");
    return { ok: true, id: up.path, url: up.url };
  } catch (e) {
    return fail(e, tenant.language);
  }
}

export async function askAssistant(input: {
  history: ChatTurn[];
  message: string;
  imageIds: string[];
  draft: Draft | null;
}): Promise<Result<{ reply: string; draft: Draft; left: number }>> {
  const { tenant } = await requireUser(["owner"]);
  const t = makeT(tenant.language);
  try {
    const history = z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(8000) })).max(40).parse(input.history);
    const message = z.string().max(4000).parse(input.message);
    const imageIds = z.array(z.string().max(40)).max(8).parse(input.imageIds);
    if (!message.trim() && !imageIds.length) return { error: t("Write something or attach an image.") };

    const { proposal, left } = await askMenuAssistant({ tenant, history, message, imageIds, draft: input.draft });
    const previous = new Map((input.draft?.changes ?? []).map((c) => [`${c.op}:${c.itemId ?? c.name.toLowerCase()}`, c]));
    const draft: Draft = {
      newCategories: proposal.new_categories,
      changes: proposal.changes.map((c) => {
        const img = c.photo ? imageIds[c.photo.image] : undefined;
        // An unchanged item keeps the crop the owner may have adjusted by hand.
        const prev = previous.get(`${c.op}:${c.item_id ?? c.name.toLowerCase()}`);
        return {
          key: uid(),
          op: c.op,
          itemId: c.item_id,
          name: c.name,
          price: rm(c.price),
          description: c.description ?? "",
          category: c.category ?? "",
          available: c.available,
          groups: c.addon_groups
            ? c.addon_groups.map((g) => ({
                name: g.name,
                required: g.required,
                maxSelect: Math.max(1, Math.min(g.max_select, g.options.length || 1)),
                options: g.options.map((o) => ({ name: o.name, price: o.extra_price ? rm(o.extra_price) : "" })),
              }))
            : null,
          photo: prev?.photo && img === prev.photo.imageId ? prev.photo : img && c.photo ? { imageId: img, box: c.photo.box } : null,
        };
      }),
    };
    return { ok: true, reply: proposal.reply, draft, left };
  } catch (e) {
    return fail(e, tenant.language);
  }
}

/** Crops the item's photo out of the poster, scaled for the menu. Box is 0-1000 of the image. */
async function cropPhoto(tenantId: string, photo: NonNullable<DraftChange["photo"]>) {
  const src = await getImage(tenantId, photo.imageId);
  if (!src) throw new OrderError("The original image for one of the items is gone. Attach the poster again.");
  const meta = await sharp(src.data).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  const left = Math.round(clamp(photo.box.x, 1000) * W / 1000);
  const top = Math.round(clamp(photo.box.y, 1000) * H / 1000);
  const width = Math.max(8, Math.min(W - left, Math.round(clamp(photo.box.w, 1000) * W / 1000)));
  const height = Math.max(8, Math.min(H - top, Math.round(clamp(photo.box.h, 1000) * H / 1000)));
  const out = await sharp(src.data)
    .extract({ left, top, width, height })
    .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82 })
    .toBuffer();
  return putImageBytes(tenantId, out, "image/jpeg");
}

function toGroups(menuItemId: string, groups: NonNullable<DraftChange["groups"]>, name: string): ModifierGroup[] {
  return groups.map((g, gi) => {
    const groupId = uid();
    return {
      id: groupId,
      menuItemId,
      name: g.name,
      required: g.required,
      maxSelect: Math.min(g.maxSelect, g.options.length),
      sort: gi,
      options: g.options.map((o, oi) => {
        const p = o.price.trim() ? toSen(o.price) : 0;
        if (!Number.isFinite(p) || p < 0) throw new OrderError('Check the extra price for "{option}" on {name}.', { option: o.name, name });
        return { id: uid(), groupId, name: o.name, price: p, sort: oi };
      }),
    };
  });
}

/** Applies the reviewed draft: creates categories, adds/updates/removes items, crops photos. */
export async function applyDraft(input: Draft): Promise<Result<{ message: string }>> {
  const { tenant } = await requireUser(["owner"]);
  const t = makeT(tenant.language);
  try {
    const draft = DraftS.parse(input);
    if (!draft.changes.length) return { error: t("The draft is empty.") };

    // Check everything before writing anything.
    const problems: string[] = [];
    for (const c of draft.changes) {
      if (c.op === "remove") continue;
      if (c.op === "add" && !c.category.trim()) problems.push(t("{name}: pick a category", { name: c.name }));
      if (c.op === "add" || c.price.trim()) {
        const p = toSen(c.price);
        if (!Number.isFinite(p) || p <= 0) problems.push(t("{name}: price isn't right yet", { name: c.name }));
      }
    }
    if (problems.length) return { error: t("Fix these first: {problems}.", { problems: problems.join("; ") }) };

    // Categories by name, creating the missing ones at the end of the menu.
    const cats = await listCategories(tenant.id);
    const byName = new Map(cats.map((c) => [c.name.trim().toLowerCase(), c.id]));
    let nextSort = (cats.at(-1)?.sort ?? -1) + 1;
    const wanted = [...draft.newCategories, ...draft.changes.map((c) => c.category)].map((n) => n.trim()).filter(Boolean);
    for (const name of wanted) {
      if (byName.has(name.toLowerCase())) continue;
      const id = uid();
      await col.of(tenant.id, "categories").doc(id).create({ tenantId: tenant.id, name: name.slice(0, 40), sort: nextSort++ });
      byName.set(name.toLowerCase(), id);
    }

    const items = col.of(tenant.id, "menuItems");
    let added = 0, updated = 0, removed = 0;
    const base = Date.now();
    for (const [i, c] of draft.changes.entries()) {
      if (c.op === "remove") {
        if (!c.itemId) continue;
        const old = read<MenuItem>(await items.doc(c.itemId).get());
        if (!old) continue;
        await items.doc(c.itemId).delete();
        await deleteImage(old.imagePath);
        removed++;
        continue;
      }

      const photo = c.photo ? await cropPhoto(tenant.id, c.photo) : null;
      const categoryId = c.category.trim() ? byName.get(c.category.trim().toLowerCase()) : undefined;

      if (c.op === "add") {
        const id = uid();
        const item: Omit<MenuItem, "id"> = {
          tenantId: tenant.id,
          categoryId: categoryId!,
          name: c.name,
          price: toSen(c.price),
          description: c.description.trim() || null,
          imageUrl: photo?.url ?? null,
          imagePath: photo?.path ?? null,
          available: c.available ?? true,
          sort: base + i,
          groups: c.groups ? toGroups(id, c.groups, c.name) : [],
        };
        await items.doc(id).create(item);
        added++;
      } else {
        if (!c.itemId) continue;
        const ref = items.doc(c.itemId);
        const oldPhoto = await fs().runTransaction(async (tx) => {
          const old = read<MenuItem>(await tx.get(ref));
          if (!old) throw new OrderError("{name} is no longer on the menu.", { name: c.name });
          const patch: Partial<MenuItem> = { name: c.name };
          if (c.price.trim()) patch.price = toSen(c.price);
          if (c.description.trim()) patch.description = c.description.trim();
          if (categoryId && categoryId !== old.categoryId) Object.assign(patch, { categoryId, sort: base + i });
          if (c.available !== null) patch.available = c.available;
          if (c.groups) patch.groups = toGroups(old.id, c.groups, c.name);
          if (photo) Object.assign(patch, { imageUrl: photo.url, imagePath: photo.path });
          tx.update(ref, patch);
          return photo ? old.imagePath : null;
        });
        await deleteImage(oldPhoto);
        updated++;
      }
    }

    revalidatePath("/app/menu");
    const parts = [
      added && t("{n} added", { n: added }),
      updated && t("{n} updated", { n: updated }),
      removed && t("{n} removed", { n: removed }),
    ].filter(Boolean);
    return { ok: true, message: t("Menu saved: {parts}.", { parts: parts.join(", ") || t("no changes") }) };
  } catch (e) {
    return fail(e, tenant.language);
  }
}
