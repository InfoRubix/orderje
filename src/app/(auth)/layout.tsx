import Link from "next/link";
import { Check } from "lucide-react";
import { Logo } from "@/components/brand";
import { Awning, KitchenTicket, PhoneMenu } from "@/components/landing/graphics";

const POINTS = ["Customer scan QR, terus order dari meja", "Dapur nampak tiket serta-merta", "Tutup kedai dengan rekon yang tepat"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh md:grid-cols-[1fr_minmax(0,520px)]">
      <section className="relative hidden overflow-hidden border-r-[6px] border-[#24211d] bg-sign text-cream md:flex md:flex-col">
        <Awning id="awning-auth" className="h-10 shrink-0" />
        <div className="h-0.5 shrink-0 bg-[#24211d]" />
        <div
          className="pointer-events-none absolute inset-0 top-12 opacity-[0.16]"
          style={{ backgroundImage: "radial-gradient(#fff4de 1.2px, transparent 1.3px)", backgroundSize: "20px 20px" }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-1 flex-col p-12 pt-10">
          <Link href="/" aria-label="OrderTerus" className="w-fit">
            <Logo tone="cream" className="w-56" />
          </Link>
          <div className="my-auto max-w-sm py-10 lg:max-w-md 2xl:max-w-2xl">
            <p className="font-display text-6xl 2xl:text-8xl">
              Order terus.
              <br />
              Senang&nbsp;je.
            </p>
            <ul className="mt-6 space-y-2.5 2xl:text-lg">
              {POINTS.map((p) => (
                <li key={p} className="flex items-center gap-3 font-semibold">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-cream text-sign">
                    <Check className="size-4" strokeWidth={3} aria-hidden />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-cream/60">Produk Rubix Technology (M) Sdn Bhd</p>
        </div>

        {/* product vignette bleeding off the bottom-right corner */}
        <div className="pointer-events-none absolute -bottom-24 right-6 hidden origin-bottom-right xl:block 2xl:right-20 2xl:scale-110" aria-hidden>
          <PhoneMenu className="rotate-[-5deg]" />
          <KitchenTicket className="ticket-in absolute -left-36 top-20 hidden min-[1440px]:block" />
        </div>
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
