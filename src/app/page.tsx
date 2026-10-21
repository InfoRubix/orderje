import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import { buttonVariants } from "@/components/ui";

export default async function Home() {
  const s = await getSession();
  if (s) redirect(homeFor(s.role));

  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-2xl font-bold">OrderJe</span>
        <Link href="/login" className={buttonVariants({ variant: "secondary" })}>
          Log in
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-8 md:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Customers order from the table. You just cook and collect.
          </h1>
          <p className="mt-5 max-w-lg text-lg text-ink-soft">
            QR ordering, kitchen screen, counter POS and end-of-day recon for kedai makan. Customers pay by cash,
            DuitNow QR or company credit, and member, staff and corporate pricing is one tap at the counter.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {process.env.ALLOW_SIGNUP !== "false" ? (
              <Link href="/signup" className={buttonVariants({ size: "xl" })}>
                Set up your kedai
              </Link>
            ) : null}
            <a href="https://wa.me/" className={buttonVariants({ size: "xl", variant: "secondary" })}>
              Talk to Rubix
            </a>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm" aria-hidden>
          <div className="slip rotate-[-2deg] rounded-t-lg px-6 pb-8 pt-5 font-mono text-sm">
            <div className="flex items-baseline justify-between border-b border-dashed border-line pb-3">
              <span className="font-display text-3xl font-bold">#047</span>
              <span className="font-sans font-semibold">Meja 6</span>
            </div>
            <ul className="space-y-2 py-4">
              <li className="flex justify-between">
                <span>2 × Roti Telur</span>
                <span>5.00</span>
              </li>
              <li className="flex justify-between">
                <span>1 × Mee Goreng Mamak</span>
                <span>7.00</span>
              </li>
              <li className="pl-5 text-ink-soft">Extra pedas</li>
              <li className="flex justify-between">
                <span>3 × Teh Tarik</span>
                <span>9.00</span>
              </li>
              <li className="pl-5 text-ink-soft">Ais, kurang manis</li>
            </ul>
            <div className="flex justify-between border-t border-dashed border-line pt-3 font-bold">
              <span>TOTAL</span>
              <span>RM 21.00</span>
            </div>
            <p className="mt-3 text-center font-sans text-xs font-semibold text-pandan">PAID · DuitNow QR</p>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-3">
          {[
            ["Order from the table", "Every table gets its own QR. Customers pick add-ons like ais or kurang manis, and the order lands in the kitchen tagged with the table."],
            ["Pay any way", "Cash with 5-sen rounding, DuitNow QR confirmed against your bank app, or company credit settled monthly."],
            ["Close the day in minutes", "Count the drawer, check the bank app, and see exactly where cash or QR is short or over."],
          ].map(([t, d]) => (
            <div key={t}>
              <h2 className="font-display text-xl font-bold">{t}</h2>
              <p className="mt-2 text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-6 py-8 text-sm text-mute">OrderJe by Rubix Technology (M) Sdn Bhd</footer>
    </main>
  );
}
