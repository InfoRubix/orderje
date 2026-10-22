import Link from "next/link";
import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh md:grid-cols-[1fr_minmax(0,520px)]">
      <section className="relative hidden overflow-hidden border-r-[6px] border-[#24211d] bg-sign p-12 text-white md:flex md:flex-col md:justify-between">
        <Link href="/" aria-label="OrderTerus">
          <Logo tone="cream" className="w-56" />
        </Link>
        <div className="max-w-md">
          <p className="font-display text-6xl">
            Order terus. Senang je.
          </p>
          <p className="mt-4 text-white/80">
            Customers order from the QR on their table. The kitchen sees it instantly. At closing, cash and
            DuitNow QR reconcile in one screen.
          </p>
        </div>
        <p className="text-sm text-white/60">A Rubix Technology product</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link href="/" aria-label="OrderTerus" className="mb-8 inline-block md:hidden">
            <Logo className="w-44" />
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
