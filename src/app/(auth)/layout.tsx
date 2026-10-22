import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh md:grid-cols-[1fr_minmax(0,520px)]">
      <section className="relative hidden overflow-hidden border-r-[6px] border-tag bg-sign p-12 text-white md:flex md:flex-col md:justify-between">
        <Link href="/" className="font-display text-4xl text-tag">
          OrderJe
        </Link>
        <div className="max-w-md">
          <p className="font-display text-6xl">
            Scan, order, makan. The counter just collects.
          </p>
          <p className="mt-4 text-white/80">
            Customers order from the QR on their table. The kitchen sees it instantly. At closing, cash and
            DuitNow QR reconcile in one screen.
          </p>
        </div>
        <p className="text-sm text-white/60">A Rubix Technology product</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
