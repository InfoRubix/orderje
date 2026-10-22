import Link from "next/link";
import { LoginForm } from "./form";

export const metadata = { title: "Log in" };

const ERR: Record<string, string> = {
  inactive: "Your account was deactivated. Ask the owner to reactivate it.",
  suspended: "This kedai's subscription is suspended. Contact Rubix support.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Log in</h1>
      <p className="mt-1 text-sm text-ink-soft">Owner, cashier or kitchen staff.</p>
      <LoginForm notice={e ? ERR[e] : undefined} />
      {process.env.ALLOW_SIGNUP !== "false" ? (
        <p className="mt-6 text-sm text-ink-soft">
          New kedai?{" "}
          <Link href="/signup" className="font-bold text-ink underline decoration-tag decoration-[3px] underline-offset-4">
            Create an account
          </Link>
        </p>
      ) : null}
    </div>
  );
}
