"use client";

import { useActionState, useState } from "react";
import { signup } from "../actions";
import { Button, Field, FormError, Input } from "@/components/ui";

const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={action} className="mt-6 space-y-4">
      <FormError message={state?.error} />
      <Field label="Kedai name">
        <Input
          name="shopName"
          required
          placeholder="Restoran Ali Maju"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(toSlug(e.target.value));
          }}
        />
      </Field>
      <Field label="Menu link name" hint={`Customers' menu lives at /t/${slug || "your-kedai"}/…`}>
        <Input
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(toSlug(e.target.value));
          }}
        />
      </Field>
      <Field label="Your name">
        <Input name="ownerName" required autoComplete="name" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="How many tables?" hint="Each table gets its own QR code. Add more anytime.">
        <Input name="tables" type="number" min={0} max={200} defaultValue={10} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="sample" defaultChecked className="size-4 accent-pandan" />
        Start with a sample mamak menu
      </label>
      <Button className="w-full" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create kedai"}
      </Button>
    </form>
  );
}
