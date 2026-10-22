"use client";

import { keep } from "@/lib/keep-form";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { rm } from "@/lib/money";
import { shrinkImage } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";
import { Button, Card, Empty, Field, FormError, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { ItemThumb } from "@/components/thumb";
import { useT } from "@/components/i18n";
import {
  addCategory,
  deleteCategory,
  deleteMenuItem,
  moveCategory,
  renameCategory,
  saveItem,
  toggleAvailable,
  type ItemInput,
} from "../actions";

type Group = { name: string; required: boolean; maxSelect: number; options: { name: string; price: number }[] };
export type EditorItem = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  available: boolean;
  categoryId: string;
  groups: Group[];
};
export type EditorCategory = { id: string; name: string; items: EditorItem[] };

type Editing = { item: EditorItem | null; categoryId: string };

export function MenuEditor({ categories }: { categories: EditorCategory[] }) {
  const t = useT();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [toast, setToast] = useState<string>();
  const total = categories.reduce((s, c) => s + c.items.length, 0);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(undefined), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t("Menu")}
        sub={t(
          total === 1
            ? categories.length === 1
              ? "{n} item in {c} category. Changes show on the customer menu straight away."
              : "{n} item in {c} categories. Changes show on the customer menu straight away."
            : categories.length === 1
              ? "{n} items in {c} category. Changes show on the customer menu straight away."
              : "{n} items in {c} categories. Changes show on the customer menu straight away.",
          { n: total, c: categories.length },
        )}
        actions={
          <Button disabled={!categories.length} onClick={() => setEditing({ item: null, categoryId: categories[0].id })}>
            <Plus className="size-4" aria-hidden /> {t("Add item")}
          </Button>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {categories.length === 0 ? (
            <Empty title={t("Start with a category")}>{t("Add one on the right, like “Nasi”, “Roti” or “Minuman”.")}</Empty>
          ) : null}
          {categories.map((c, ci) => (
            <CategoryCard
              key={c.id}
              c={c}
              first={ci === 0}
              last={ci === categories.length - 1}
              onEdit={(item) => setEditing({ item, categoryId: c.id })}
              onAdd={() => setEditing({ item: null, categoryId: c.id })}
            />
          ))}
        </div>
        <aside className="space-y-4">
          <NewCategory />
          <Card className="space-y-2 p-5 text-sm text-ink-soft">
            <p className="font-semibold text-ink">{t("Tips")}</p>
            <p>{t("Add a photo to each item. Menus with photos get more add-ons ordered.")}</p>
            <p>{t("Use add-on groups for choices like Original / Crispy or the free air. Make it required when the kitchen must know.")}</p>
            <p>{t("Mark items sold out instead of deleting them, so they come back tomorrow with one tap.")}</p>
          </Card>
        </aside>
      </div>

      {editing ? (
        <ItemEditor
          key={editing.item?.id ?? `new-${editing.categoryId}`}
          item={editing.item}
          categoryId={editing.categoryId}
          categories={categories}
          onClose={() => setEditing(null)}
          onDone={(msg) => {
            setEditing(null);
            setToast(msg);
          }}
        />
      ) : null}

      {toast ? (
        <div role="status" className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-on-ink shadow-lg md:bottom-8">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function NewCategory() {
  const t = useT();
  const [state, action, pending] = useActionState(addCategory, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <Card className="p-5">
      <form ref={ref} onSubmit={keep(action)} className="space-y-3">
        <h2 className="font-display text-lg font-bold">{t("New category")}</h2>
        <Input name="name" placeholder={t("e.g. Minuman Sejuk")} maxLength={40} aria-label={t("Category name")} required />
        <Button variant="secondary" className="w-full" disabled={pending}>
          {t("Add category")}
        </Button>
        <FormError message={state?.error} />
      </form>
    </Card>
  );
}

function CategoryCard({
  c,
  first,
  last,
  onEdit,
  onAdd,
}: {
  c: EditorCategory;
  first: boolean;
  last: boolean;
  onEdit: (item: EditorItem) => void;
  onAdd: () => void;
}) {
  const t = useT();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(c.name);
  const [askDelete, setAskDelete] = useState(false);
  const [err, setErr] = useState<string>();
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<{ error?: string } | undefined>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setErr(r?.error);
      if (!r?.error) after?.();
    });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-paper px-4 py-2.5">
        {renaming ? (
          <form
            className="flex flex-1 flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => renameCategory(c.id, name), () => setRenaming(false));
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="h-9 max-w-60" aria-label={t("Category name")} autoFocus />
            <Button size="sm" disabled={busy}>
              {t("Save")}
            </Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setRenaming(false)}>
              {t("Cancel")}
            </Button>
          </form>
        ) : (
          <>
            <h2 className="min-w-0 flex-1 font-display text-lg font-bold">
              {c.name} <span className="num text-sm font-normal text-mute">{c.items.length}</span>
            </h2>
            <Button size="sm" variant="ghost" disabled={first || busy} aria-label={t("Move {name} up", { name: c.name })} onClick={() => run(() => moveCategory(c.id, -1))}>
              <ArrowUp className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" disabled={last || busy} aria-label={t("Move {name} down", { name: c.name })} onClick={() => run(() => moveCategory(c.id, 1))}>
              <ArrowDown className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
              {t("Rename")}
            </Button>
            <Button size="sm" variant="ghost" className="text-chili" onClick={() => setAskDelete(true)}>
              {t("Delete")}
            </Button>
          </>
        )}
      </div>
      {askDelete ? (
        <div className="flex flex-wrap items-center gap-2 bg-chili-soft px-4 py-2.5 text-sm text-chili">
          <span className="font-semibold">
            {c.items.length
              ? t(c.items.length === 1 ? "Delete {name} and its {n} item?" : "Delete {name} and its {n} items?", { name: c.name, n: c.items.length })
              : t("Delete {name}?", { name: c.name })}
          </span>
          <Button size="sm" variant="danger" disabled={busy} onClick={() => run(() => deleteCategory(c.id))}>
            {t("Delete")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAskDelete(false)}>
            {t("Keep it")}
          </Button>
        </div>
      ) : null}
      {err ? <p className="px-4 py-2 text-sm text-chili">{err}</p> : null}
      <ul className="divide-y divide-line">
        {c.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-4 py-3">
            <ItemThumb name={i.name} src={i.imageUrl} className="size-12" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{i.name}</p>
              <p className="truncate text-sm text-ink-soft">
                <span className="num">{rm(i.price)}</span>
                {i.description ? ` · ${i.description}` : ""}
              </p>
              {i.groups.length ? (
                <p className="truncate text-xs text-mute">{i.groups.map((g) => g.name + (g.required ? ` (${t("required")})` : "")).join(", ")}</p>
              ) : null}
            </div>
            <AvailableToggle id={i.id} available={i.available} />
            <Button size="sm" variant="secondary" onClick={() => onEdit(i)} aria-label={t("Edit {name}", { name: i.name })}>
              {t("Edit")}
            </Button>
          </li>
        ))}
        <li className="px-4 py-2.5">
          <button onClick={onAdd} className="text-sm font-bold text-ink underline decoration-tag decoration-[3px] underline-offset-4">
            {t("+ Add item to {category}", { category: c.name })}
          </button>
        </li>
      </ul>
    </Card>
  );
}

function AvailableToggle({ id, available }: { id: string; available: boolean }) {
  const t = useT();
  const [on, setOn] = useState(available);
  const [, start] = useTransition();
  useEffect(() => setOn(available), [available]);
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => {
        setOn(!on);
        start(async () => {
          await toggleAvailable(id, !on);
        });
      }}
      className={cn("shrink-0 rounded-sm px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider", on ? "bg-pandan-soft text-pandan-dark" : "bg-chili text-white")}
    >
      {on ? t("Available") : t("Sold out")}
    </button>
  );
}

type DraftGroup = { name: string; required: boolean; maxSelect: string; options: { name: string; price: string }[] };

function ItemEditor({
  item,
  categoryId,
  categories,
  onClose,
  onDone,
}: {
  item: EditorItem | null;
  categoryId: string;
  categories: EditorCategory[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item ? (item.price / 100).toFixed(2) : "");
  const [cat, setCat] = useState(categoryId);
  const [description, setDescription] = useState(item?.description ?? "");
  const [soldOut, setSoldOut] = useState(item ? !item.available : false);
  const [groups, setGroups] = useState<DraftGroup[]>(
    (item?.groups ?? []).map((g) => ({
      name: g.name,
      required: g.required,
      maxSelect: String(g.maxSelect),
      options: g.options.map((o) => ({ name: o.name, price: o.price ? (o.price / 100).toFixed(2) : "" })),
    })),
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(item?.imageUrl ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [err, setErr] = useState<string>();
  const [busy, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const g = (gi: number, patch: Partial<DraftGroup>) => setGroups((x) => x.map((v, i) => (i === gi ? { ...v, ...patch } : v)));
  const opt = (gi: number, oi: number, patch: Partial<{ name: string; price: string }>) =>
    g(gi, { options: groups[gi].options.map((o, i) => (i === oi ? { ...o, ...patch } : o)) });

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setErr(undefined);
    try {
      const small = await shrinkImage(file, 1000);
      setPhoto(small);
      setPhotoUrl(URL.createObjectURL(small));
      setRemovePhoto(false);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function save() {
    // Drop fully empty rows the owner added and never filled in.
    const cleaned = groups
      .map((x) => ({ ...x, options: x.options.filter((o) => o.name.trim()) }))
      .filter((x) => x.name.trim() || x.options.length);
    const data: ItemInput = {
      id: item?.id,
      name,
      price,
      categoryId: cat,
      description,
      available: !soldOut,
      groups: cleaned.map((x) => ({
        name: x.name,
        required: x.required,
        maxSelect: Math.max(1, parseInt(x.maxSelect, 10) || 1),
        options: x.options.map((o) => ({ name: o.name, price: o.price })),
      })),
    };
    const f = new FormData();
    f.set("data", JSON.stringify(data));
    if (photo) f.set("photo", photo);
    if (removePhoto) f.set("removePhoto", "1");
    start(async () => {
      setErr(undefined);
      try {
        const r = await saveItem(f);
        if (r?.error) setErr(r.error);
        else onDone(r?.message ?? t("Saved"));
      } catch {
        setErr(t("Couldn't reach the server. Check your connection and try again."));
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal aria-label={item ? t("Edit {name}", { name: item.name }) : t("New item")}>
      <button className="absolute inset-0 bg-black/50" onClick={onClose} aria-label={t("Close")} />
      <div className="relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-xl border-2 border-edge bg-surface sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-xl font-bold">{item ? t("Edit {name}", { name: item.name }) : t("New item")}</h2>
          <button onClick={onClose} className="rounded-sm p-1 text-ink-soft hover:bg-paper" aria-label={t("Close")}>
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-1.5 text-sm font-medium">{t("Photo")}</p>
            <div className="flex flex-wrap items-center gap-4">
              <ItemThumb name={name || "?"} src={photoUrl} className="size-24 text-3xl" />
              <div className="space-y-2">
                <label className="inline-flex h-10 cursor-pointer items-center rounded-md border-2 border-edge bg-surface px-4 text-sm font-semibold hover:bg-paper">
                  {photoUrl ? t("Change photo") : t("Upload photo")}
                  <input type="file" accept="image/*" className="sr-only" aria-label={t("Upload photo")} onChange={(e) => pickPhoto(e.target.files?.[0])} />
                </label>
                {photoUrl ? (
                  <button
                    type="button"
                    className="block text-sm font-semibold text-chili hover:underline"
                    onClick={() => {
                      setPhoto(null);
                      setPhotoUrl(null);
                      setRemovePhoto(true);
                    }}
                  >
                    {t("Remove photo")}
                  </button>
                ) : (
                  <p className="text-xs text-mute">{t("Until you upload one, customers see this letter tile.")}</p>
                )}
              </div>
            </div>
          </div>
          <Field label={t("Name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={t("e.g. Nasi Ayam Penyet")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Price (RM)")}>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="8.50" className="num" />
            </Field>
            <Field label={t("Category")}>
              <Select value={cat} onChange={(e) => setCat(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t("Description")} hint={t("Shown under the name on the customer menu")}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} placeholder={t("What's in it, how spicy, portion size")} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={soldOut} onChange={(e) => setSoldOut(e.target.checked)} className="size-4 accent-pandan" />
            {t("Sold out for now")}
          </label>

          <div className="space-y-3">
            <p className="text-sm font-medium">{t("Add-ons & choices")}</p>
            {groups.map((x, gi) => (
              <div key={gi} className="space-y-2 rounded-md border-2 border-edge p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2">
                  <Input value={x.name} onChange={(e) => g(gi, { name: e.target.value })} placeholder={t("Group, e.g. Panas / Ais")} aria-label={t("Group name")} />
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={x.required} onChange={(e) => g(gi, { required: e.target.checked })} className="size-4 accent-pandan" />
                    {t("Required")}
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    {t("Max")}
                    <Input value={x.maxSelect} onChange={(e) => g(gi, { maxSelect: e.target.value })} inputMode="numeric" className="num h-9 w-12 px-2" aria-label={t("Max picks")} />
                  </label>
                  <Button variant="ghost" size="sm" aria-label={t("Remove group")} onClick={() => setGroups((v) => v.filter((_, i) => i !== gi))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {x.options.map((o, oi) => (
                  <div key={oi} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-2">
                    <Input value={o.name} onChange={(e) => opt(gi, oi, { name: e.target.value })} placeholder={t("Option, e.g. Ais")} aria-label={t("Option name")} className="h-9" />
                    <Input value={o.price} onChange={(e) => opt(gi, oi, { price: e.target.value })} placeholder="+RM 0.00" inputMode="decimal" aria-label={t("Extra price")} className="num h-9" />
                    <Button variant="ghost" size="sm" aria-label={t("Remove option")} onClick={() => g(gi, { options: x.options.filter((_, i) => i !== oi) })}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <button type="button" className="text-sm font-bold text-ink underline decoration-tag decoration-[3px] underline-offset-4" onClick={() => g(gi, { options: [...x.options, { name: "", price: "" }] })}>
                  {t("+ Option")}
                </button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setGroups((v) => [...v, { name: "", required: false, maxSelect: "1", options: [{ name: "", price: "" }] }])}
            >
              <Plus className="size-4" /> {t("Add-on group")}
            </Button>
          </div>
          <FormError message={err} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4">
          <Button size="lg" disabled={busy} onClick={save}>
            {busy ? t("Saving…") : item ? t("Save changes") : t("Add to menu")}
          </Button>
          <Button size="lg" variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          {item ? (
            askDelete ? (
              <span className="ml-auto flex items-center gap-2 text-sm">
                {t("Delete for good?")}
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      const r = await deleteMenuItem(item.id);
                      if (r?.error) setErr(r.error);
                      else onDone(r?.message ?? t("Deleted"));
                    })
                  }
                >
                  {t("Delete")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAskDelete(false)}>
                  {t("No")}
                </Button>
              </span>
            ) : (
              <Button variant="ghost" className="ml-auto text-chili" onClick={() => setAskDelete(true)}>
                {t("Delete item")}
              </Button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
