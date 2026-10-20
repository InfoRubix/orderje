import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh md:grid-cols-[1fr_minmax(0,520px)]">
      <section className="relative hidden overflow-hidden bg-pandan p-12 text-white md:flex md:flex-col md:justify-between">
        <Link href="/" className="font-display text-2xl font-bold">
          OrderJe
        </Link>
        <div className="max-w-md">
          <p className="font-display text-4xl font-bold leading-tight">
            Scan, order, makan. The counter just collects.
          </p>
          <p className="mt-4 text-white/80">
            Customers order from the QR on their table. The kitchen sees it instantly. At closing, cash, QR and
            online payments reconcile in one screen.
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
