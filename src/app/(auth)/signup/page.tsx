import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "./form";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default function SignupPage() {
  if (process.env.ALLOW_SIGNUP === "false") redirect("/login");
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Set up your kedai</h1>
      <p className="mt-1 text-sm text-ink-soft">Takes a minute. You can change everything later.</p>
      <SignupForm />
      <p className="mt-6 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-ink underline decoration-tag decoration-[3px] underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
