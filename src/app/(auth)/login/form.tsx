"use client";

import { keep } from "@/lib/keep-form";
import { useActionState } from "react";
import { login } from "../actions";
import { Button, Field, FormError, Input } from "@/components/ui";
import { useT } from "@/components/i18n";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const t = useT();
  return (
    <form onSubmit={keep(action)} className="mt-6 space-y-4">
      <FormError message={state?.error ?? notice} />
      <Field label={t("Email")}>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={t("Password")}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button className="w-full" size="lg" disabled={pending}>
        {pending ? t("Logging in…") : t("Log in")}
      </Button>
    </form>
  );
}
