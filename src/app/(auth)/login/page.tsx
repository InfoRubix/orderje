import Link from "next/link";
import { makeT } from "@/lib/i18n";
import { requestLang } from "@/lib/i18n/server";
import { LoginForm } from "./form";

export async function generateMetadata() {
  return { title: makeT(await requestLang())("Log in") };
}

const ERR: Record<string, string> = {
  inactive: "Your account was deactivated. Ask the owner to reactivate it.",
  suspended: "This kedai's subscription is suspended. Contact Rubix support.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const t = makeT(await requestLang());
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">{t("Log in")}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t("Owner, cashier or kitchen staff.")}</p>
      <LoginForm notice={e && ERR[e] ? t(ERR[e]) : undefined} />
      {process.env.ALLOW_SIGNUP !== "false" ? (
        <p className="mt-6 text-sm text-ink-soft">
          {t("New kedai?")}{" "}
          <Link href="/signup" className="font-bold text-ink underline decoration-tag decoration-[3px] underline-offset-4">
            {t("Create an account")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
