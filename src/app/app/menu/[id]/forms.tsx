"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { deleteMenuItem, saveMenuItem, saveModifiers } from "../../actions";

type ItemDraft = {
  id?: string;
  name?: string;
  price?: string;
  description?: string;
  imageUrl?: string;
  categoryId: string;
  available?: boolean;
};

export function ItemForm({ categories, item }: { categories: { id: string; name: string }[]; item: ItemDraft }) {
  const [state, action, pending] = useActionState(saveMenuItem, undefined);
  const [, start] = useTransition();
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {item.id ? <input type="hidden" name="id" value={item.id} /> : null}
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" defaultValue={item.name} required maxLength={120} />
      </Field>
      <Field label="Price (RM)">
        <Input name="price" defaultValue={item.price} inputMode="decimal" required placeholder="7.50" className="num" />
      </Field>
      <Field label="Category">
        <Select name="categoryId" defaultValue={item.categoryId}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description" className="sm:col-span-2" hint="Optional. Shown under the name on the customer menu.">
        <Input name="description" defaultValue={item.description} maxLength={255} />
      </Field>
      <Field label="Photo link" className="sm:col-span-2" hint="Optional. An https:// image link, e.g. from your Facebook page.">
        <Input name="imageUrl" defaultValue={item.imageUrl} type="url" placeholder="https://" />
      </Field>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="available" defaultChecked={item.available ?? true} className="size-4 accent-pandan" />
        Available to order
      </label>
      <div className="sm:col-span-2">
        <FormError message={state?.error} />
        {state?.message ? <p className="text-sm font-semibold text-pandan">{state.message}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button disabled={pending}>{item.id ? "Save item" : "Create item"}</Button>
        {item.id ? (
          <Button
            type="button"
            variant="ghost"
            className="text-chili"
            onClick={() => confirm("Delete this item? Past orders keep their record.") && start(() => deleteMenuItem(item.id!).then(() => {}))}
          >
            Delete item
          </Button>
        ) : null}
      </div>
    </form>
  );
}

type Group = { name: string; required: boolean; maxSelect: number; options: { name: string; price: string }[] };

export function ModifierEditor({ menuItemId, initial }: { menuItemId: string; initial: Group[] }) {
  const [groups, setGroups] = useState<Group[]>(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [busy, start] = useTransition();
  const update = (gi: number, patch: Partial<Group>) => setGroups((g) => g.map((x, i) => (i === gi ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-4">
      {groups.map((g, gi) => (
        <div key={gi} className="rounded-lg border border-line p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Group name" className="min-w-48 flex-1">
              <Input value={g.name} onChange={(e) => update(gi, { name: e.target.value })} placeholder="Panas / Ais" />
            </Field>
            <Field label="Max picks">
              <Input
                type="number"
                min={1}
                max={20}
                value={g.maxSelect}
                onChange={(e) => update(gi, { maxSelect: Math.max(1, Number(e.target.value) || 1) })}
                className="w-20"
              />
            </Field>
            <label className="flex h-10 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={g.required}
                onChange={(e) => update(gi, { required: e.target.checked })}
                className="size-4 accent-pandan"
              />
              Required
            </label>
            <Button
              variant="ghost"
              className="text-chili"
              onClick={() => setGroups((x) => x.filter((_, i) => i !== gi))}
              aria-label="Remove group"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {g.options.map((o, oi) => (
              <div key={oi} className="flex gap-2">
                <Input
                  value={o.name}
                  placeholder="Option, e.g. Ais"
                  aria-label="Option name"
                  onChange={(e) =>
                    update(gi, { options: g.options.map((x, i) => (i === oi ? { ...x, name: e.target.value } : x)) })
                  }
                />
                <Input
                  value={o.price}
                  placeholder="+RM 0.00"
                  inputMode="decimal"
                  aria-label="Extra price"
                  className="num w-28"
                  onChange={(e) =>
                    update(gi, { options: g.options.map((x, i) => (i === oi ? { ...x, price: e.target.value } : x)) })
                  }
                />
                <Button
                  variant="ghost"
                  aria-label="Remove option"
                  onClick={() => update(gi, { options: g.options.filter((_, i) => i !== oi) })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => update(gi, { options: [...g.options, { name: "", price: "" }] })}>
              <Plus className="size-4" /> Option
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => setGroups((g) => [...g, { name: "", required: false, maxSelect: 1, options: [{ name: "", price: "" }] }])}
        >
          <Plus className="size-4" /> Add-on group
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            start(async () => {
              const r = await saveModifiers(menuItemId, groups);
              setMsg(r?.error ? { error: r.error } : { ok: r?.message });
            })
          }
        >
          Save add-ons
        </Button>
        {msg.ok ? <span className="text-sm font-semibold text-pandan">{msg.ok}</span> : null}
      </div>
      <FormError message={msg.error} />
    </div>
  );
}
