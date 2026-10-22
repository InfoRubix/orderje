import Link from "next/link";
import { redirect } from "next/navigation";
import { makeT } from "@/lib/i18n";
import { requestLang } from "@/lib/i18n/server";
import { SignupForm } from "./form";

export async function generateMetadata() {
  return { title: makeT(await requestLang())("Create account") };
}
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (process.env.ALLOW_SIGNUP === "false") redirect("/login");
  const t = makeT(await requestLang());
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t("Set up your kedai")}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t("Takes a minute. You can change everything later.")}</p>
      <SignupForm />
      <p className="mt-6 text-sm text-ink-soft">
        {t("Already have an account?")}{" "}
        <Link href="/login" className="font-bold text-ink underline decoration-tag decoration-[3px] underline-offset-4">
          {t("Log in")}
        </Link>
      </p>
    </div>
  );
}
