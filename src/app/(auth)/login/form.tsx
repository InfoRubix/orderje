"use client";

import { useActionState } from "react";
import { login } from "../actions";
import { Button, Field, FormError, Input } from "@/components/ui";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <FormError message={state?.error ?? notice} />
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button className="w-full" size="lg" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </Button>
    </form>
  );
}
