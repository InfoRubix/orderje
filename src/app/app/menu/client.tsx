"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, FormError, Input } from "@/components/ui";
import { deleteCategory, saveCategory, toggleAvailable } from "../actions";

export function NewCategory() {
  const [state, action, pending] = useActionState(saveCategory, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="mb-6 flex flex-wrap gap-2">
      <Input name="name" placeholder="New category, e.g. Minuman" className="max-w-xs" required />
      <Button variant="secondary" disabled={pending}>
        Add category
      </Button>
      <div className="w-full">
        <FormError message={state?.error} />
      </div>
    </form>
  );
}

export function CategoryEditor({ id, name, sort, count }: { id: string; name: string; sort: number; count: number }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (p: Awaited<ReturnType<typeof saveCategory>>, f: FormData) => {
    const r = await saveCategory(p, f);
    if (r?.ok) setEditing(false);
    return r;
  }, undefined);
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string>();

  if (editing) {
    return (
      <form action={action} className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-5 py-3">
        <input type="hidden" name="id" value={id} />
        <Input name="name" defaultValue={name} className="max-w-xs" required aria-label="Category name" />
        <Input name="sort" type="number" defaultValue={sort} className="w-20" aria-label="Order" title="Display order" />
        <Button size="sm" disabled={pending}>
          Save
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <FormError message={state?.error} />
      </form>
    );
  }
  return (
    <div className="flex items-center justify-between border-b border-line bg-paper px-5 py-3">
      <h2 className="font-display text-lg font-bold">
        {name} <span className="num text-sm font-normal text-mute">{count}</span>
      </h2>
      <div className="flex items-center gap-1">
        {err ? <span className="mr-2 text-sm text-chili">{err}</span> : null}
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`Rename ${name}`}>
          <Pencil className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          aria-label={`Delete ${name}`}
          onClick={() =>
            confirm(`Delete category ${name}?`) &&
            start(async () => {
              const r = await deleteCategory(id);
              setErr(r?.error);
            })
          }
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function AvailableToggle({ id, available }: { id: string; available: boolean }) {
  const [on, setOn] = useState(available);
  const [, start] = useTransition();
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
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold",
        on ? "bg-pandan-soft text-pandan-dark" : "bg-chili-soft text-chili",
      )}
    >
      {on ? "Available" : "Sold out"}
    </button>
  );
}
