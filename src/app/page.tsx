import Link from "next/link";
import QRCode from "qrcode";
import { ArrowRight, BellRing, ChefHat, Receipt, ScanLine, Store, Utensils } from "lucide-react";
import { appUrl, cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui";
import { BrandIcon, BrandMark, Logo } from "@/components/brand";
import { Awning, KitchenTicket, MiniChart, MiniReceipt, PhoneMenu, TableTent } from "@/components/landing/graphics";

export const metadata = {
  title: { absolute: "OrderTerus · Sistem order QR & kaunter untuk kedai makan" },
  description:
    "Customer order dari meja dengan QR, dapur terus nampak, bayar di kaunter. Menu QR, skrin dapur, POS kaunter dan rekon hujung hari dalam satu sistem.",
};

const STEPS = [
  {
    icon: ScanLine,
    title: "Customer scan QR di meja",
    body: "Pilih menu, pilih add-on macam ais atau kurang manis, kemudian hantar. Tak perlu download app, tak perlu daftar.",
  },
  {
    icon: ChefHat,
    title: "Dapur terus nampak",
    body: "Tiket muncul di tablet dapur dengan bunyi. Tekan Start cooking dan Ready, customer nampak status di telefon dia.",
  },
  {
    icon: Receipt,
    title: "Bayar di kaunter",
    body: "Tunai dengan bundar 5 sen, DuitNow QR dengan rujukan bank, atau kredit syarikat. Resit boleh cetak atau hantar WhatsApp.",
  },
];

const LOCAL = [
  ["SST 6% dan caj servis", "Caj servis dikira untuk makan sini sahaja. Bungkus dan delivery tak kena."],
  ["Bundar 5 sen", "Bil tunai dibundarkan ikut peraturan Bank Negara, baki dikira terus."],
  ["DuitNow QR", "Juruwang masukkan rujukan bank. Hujung hari, tanda satu-satu dengan app bank."],
  ["Member, staf, korporat", "Diskaun member dan staf automatik. Syarikat makan dulu, bayar hujung bulan dengan had kredit."],
  ["Makan sini atau bungkus", "Customer pilih sendiri. Order bungkus wajib letak nama supaya senang dipanggil."],
  ["Grab dan Foodpanda", "Order delivery dikunci di kaunter dengan nama rider, masuk dapur macam order lain."],
] as const;

const FAQ = [
  ["Customer kena download app ke?", "Tidak. Customer scan QR dengan kamera telefon dan menu terus terbuka dalam browser."],
  [
    "Customer boleh bayar online dari telefon?",
    "Buat masa ni bayaran dibuat di kaunter: tunai, DuitNow QR atau kredit syarikat. Telefon customer tunjuk jumlah dan nombor order untuk ditunjuk pada juruwang.",
  ],
  [
    "Perlu beli printer atau tablet khas?",
    "Tidak. Skrin dapur jalan di mana-mana tablet atau telefon. Resit dicetak melalui browser ke printer thermal 80mm atau printer biasa, dan QR meja boleh dicetak terus dari sistem.",
  ],
  [
    "Kalau sticker QR meja disalin orang?",
    "Tekan New QR untuk meja tu. QR lama terus tak berfungsi, dan cetak yang baru.",
  ],
  [
    "Staf pakai satu akaun ke?",
    "Setiap staf ada login sendiri: owner, juruwang atau dapur. Staf dapur hanya nampak skrin dapur. Staf yang dinyahaktif terus terkeluar.",
  ],
  [
    "Boleh guna logo dan warna kedai sendiri?",
    "Boleh. Upload logo, pilih warna, tulis tagline. Menu customer, page order dan resit semua ikut jenama kedai.",
  ],
] as const;

export default async function Landing() {
  const signupOpen = process.env.ALLOW_SIGNUP !== "false";
  const start = signupOpen ? "/signup" : "/login";
  const qr = await QRCode.toString(`${appUrl()}${start}`, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#24211d", light: "#ffffff" },
  });

  return (
    <main className="theme-light min-h-dvh overflow-x-clip">
      {/* ---------------------------------------------------------------- header */}
      <header className="sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" aria-label="OrderTerus home">
            <Logo className="w-36 sm:w-40" priority />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold md:flex" aria-label="Halaman">
            <a href="#cara" className="hover:text-tag">Cara guna</a>
            <a href="#ciri" className="hover:text-tag">Ciri</a>
            <a href="#tempatan" className="hover:text-tag">Untuk kedai Malaysia</a>
            <a href="#soalan" className="hover:text-tag">Soalan</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }), "hidden sm:inline-flex")}>
              Log masuk
            </Link>
            <Link href={start} className={buttonVariants()}>
              {signupOpen ? "Cuba percuma" : "Log masuk"}
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------- hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 lg:grid-cols-[1fr_1.05fr] lg:pb-24 lg:pt-16">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-surface px-3 py-1 text-xs font-bold">
            <Store className="size-3.5" aria-hidden /> Order QR + POS kaunter untuk kedai makan
          </p>
          <h1 className="mt-5 font-display text-[2.9rem] sm:text-6xl lg:text-[4.2rem]">
            Customer order dari meja. Dapur{" "}
            <span className="relative whitespace-nowrap text-tag">
              terus
              <svg viewBox="0 0 120 12" className="absolute -bottom-2 left-0 h-3 w-full" preserveAspectRatio="none" aria-hidden>
                <path d="M3 8c30-6 80-7 114-3" fill="none" stroke="#d92d20" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>{" "}
            nampak.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            OrderTerus satukan menu QR, skrin dapur, kaunter bayaran dan rekon hujung hari dalam satu sistem. Kurang
            jerit order, kurang salah bil, tutup kedai dengan duit yang cukup.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={start} className={buttonVariants({ size: "xl" })}>
              {signupOpen ? "Cuba percuma" : "Log masuk"} <ArrowRight className="size-5" aria-hidden />
            </Link>
            <a href="#cara" className={buttonVariants({ size: "xl", variant: "secondary" })}>
              Tengok cara guna
            </a>
          </div>
          {signupOpen ? (
            <p className="mt-4 text-sm text-mute">Daftar dengan menu sampel siap diisi, terus boleh cuba. Tiada kad kredit.</p>
          ) : null}
        </div>

        {/* storefront composition: awning, phone, table tent, kitchen ticket */}
        <div className="relative mx-auto w-full max-w-[540px]" aria-label="Contoh menu QR, kad meja dan tiket dapur" role="img">
          <div className="overflow-hidden rounded-[28px] border-2 border-ink bg-[#f8e4bd]">
            <Awning id="awning-hero" className="h-9" />
            <div className="relative h-[470px] sm:h-[520px]">
              <div
                className="absolute inset-0 opacity-[0.35]"
                style={{ backgroundImage: "radial-gradient(#24211d 1.1px, transparent 1.2px)", backgroundSize: "18px 18px" }}
              />
              <PhoneMenu className="absolute left-1/2 top-6 -translate-x-1/2 sm:top-8" />
            </div>
          </div>
          <TableTent qrSvg={qr} className="absolute -bottom-10 -left-1 origin-bottom-left -rotate-3 scale-[0.78] sm:-left-8 sm:scale-100" />
          <KitchenTicket className="ticket-in absolute -right-16 top-28 hidden sm:block" />
        </div>
      </section>

      {/* ---------------------------------------------------------------- strip */}
      <section className="border-y-2 border-ink bg-ink text-cream">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-7 sm:grid-cols-3">
          {[
            ["Tiada app untuk customer", "Scan QR, terus nampak menu."],
            ["Jalan di telefon & tablet sedia ada", "Kaunter, dapur dan owner guna browser."],
            ["Setiap staf login sendiri", "Owner, juruwang dan dapur, masing-masing skrin sendiri."],
          ].map(([t, d]) => (
            <div key={t} className="flex items-start gap-3">
              <BrandMark className="mt-0.5 size-7 shrink-0 text-tag" />
              <div>
                <p className="font-bold">{t}</p>
                <p className="text-sm text-cream/70">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- how it works */}
      <section id="cara" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.14em] text-tag">Cara guna</p>
          <h2 className="mt-2 font-display text-4xl sm:text-5xl">Dari meja ke dapur ke kaunter, tanpa jerit.</h2>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border-2 border-ink bg-surface p-6">
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-xl bg-tag text-on-tag">
                  <s.icon className="size-6" aria-hidden />
                </span>
                <span className="font-display text-5xl text-line">{i + 1}</span>
              </div>
              <h3 className="mt-5 font-display text-2xl">{s.title}</h3>
              <p className="mt-2 text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------------- features by role */}
      <section id="ciri" className="scroll-mt-24 border-t-2 border-ink bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-tag">Ciri</p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">Satu sistem, empat skrin. Setiap orang nampak apa yang dia perlu.</h2>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <article className="min-w-0 overflow-hidden rounded-2xl border-2 border-ink bg-paper p-6 lg:row-span-2">
              <Utensils className="size-6 text-tag" aria-hidden />
              <h3 className="mt-3 font-display text-3xl">Menu QR jenama kedai sendiri</h3>
              <p className="mt-2 max-w-md text-ink-soft">
                Logo, warna dan tagline kedai di atas menu. Gambar setiap item, add-on wajib atau pilihan, dan tanda habis
                dengan satu tekan.
              </p>
              <div className="mt-10 flex items-end justify-center">
                <PhoneMenu compact shop="Kopitiam Ah Seng" color="#28584a" className="relative z-0 -mr-6 hidden w-[170px] shrink-0 -rotate-6 border-[7px] sm:block" />
                <PhoneMenu compact shop="Warung Pak Din" color="#d92d20" className="relative z-10 w-[170px] shrink-0 -translate-y-5 border-[7px]" />
                <PhoneMenu compact shop="Mamak Corner" color="#1f5f9e" className="relative z-0 -ml-6 hidden w-[170px] shrink-0 rotate-6 border-[7px] sm:block" />
              </div>
            </article>

            <article className="rounded-2xl border-2 border-ink bg-paper p-6">
              <BellRing className="size-6 text-tag" aria-hidden />
              <h3 className="mt-3 font-display text-3xl">Skrin dapur</h3>
              <p className="mt-2 text-ink-soft">
                Tiket New, Cooking, Ready dengan bunyi order baru dan mod skrin penuh untuk tablet di dinding. Masa menunggu
                bertukar oren selepas 8 minit dan merah selepas 15.
              </p>
              <div className="mt-5 flex gap-3 overflow-hidden">
                {(["New", "Cooking", "Ready"] as const).map((c, i) => (
                  <div key={c} className="min-w-0 flex-1">
                    <p className="mb-1.5 text-xs font-bold">{c}</p>
                    <div className="rounded-lg border-2 border-ink bg-surface p-2">
                      <p className="font-display text-xl">#{24 + i}</p>
                      <p className="truncate text-[11px] text-mute">{["Meja 5", "Bungkus · Lim", "Meja 2"][i]}</p>
                      <div className={cn("mt-2 h-1.5 rounded-full", ["bg-tag", "bg-teh", "bg-pandan"][i])} />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border-2 border-ink bg-paper p-6">
              <Store className="size-6 text-tag" aria-hidden />
              <h3 className="mt-3 font-display text-3xl">Kaunter & tauke</h3>
              <p className="mt-2 text-ink-soft">
                Bil ikut meja, diskaun member dan staf automatik, kredit syarikat dengan had. Dashboard jualan ikut jam, menu
                paling laku, dan rekon hujung hari: tunai dalam laci lawan sistem, lebih atau kurang ditunjuk terus.
              </p>
              <div className="mt-5 rounded-lg border-2 border-ink bg-surface p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-mute">Jualan ikut jam</p>
                  <p className="font-display text-xl">RM 1,284.60</p>
                </div>
                <MiniChart />
                <p className="mt-1.5 flex justify-between text-[10px] text-mute">
                  <span>7 pagi</span>
                  <span>12 tgh</span>
                  <span>7 mlm</span>
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- local details */}
      <section id="tempatan" className="scroll-mt-24 border-t-2 border-ink bg-ink text-cream">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.2fr_1fr] lg:py-28">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-tag">Untuk kedai Malaysia</p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">Dibina ikut cara kedai makan kita berniaga.</h2>
            <dl className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {LOCAL.map(([t, d]) => (
                <div key={t} className="border-t-2 border-cream/20 pt-4">
                  <dt className="font-bold">{t}</dt>
                  <dd className="mt-1 text-sm text-cream/70">{d}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex justify-center">
            <MiniReceipt className="rotate-2 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.8)]" />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- FAQ */}
      <section id="soalan" className="mx-auto max-w-3xl scroll-mt-24 px-5 py-20 lg:py-28">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-tag">Soalan</p>
        <h2 className="mt-2 font-display text-4xl sm:text-5xl">Yang selalu ditanya tauke kedai</h2>
        <div className="mt-10 divide-y-2 divide-ink border-y-2 border-ink">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                {q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink text-xl leading-none transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- closing CTA */}
      <section className="border-t-2 border-ink bg-tag text-on-tag">
        <Awning id="awning-cta" className="h-9" />
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-16 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <BrandIcon className="hidden size-20 border-2 border-cream sm:inline-grid" />
            <div>
              <p className="font-display text-4xl sm:text-5xl">Order terus. Senang&nbsp;je.</p>
              <p className="mt-2 text-cream/85">Mula dengan menu sampel, tukar kepada menu sendiri bila dah sedia.</p>
            </div>
          </div>
          <Link
            href={start}
            className="inline-flex h-14 items-center gap-2 rounded-xl border-2 border-ink bg-cream px-7 text-lg font-bold text-ink hover:bg-white"
          >
            {signupOpen ? "Cuba percuma" : "Log masuk"} <ArrowRight className="size-5" aria-hidden />
          </Link>
        </div>
      </section>

      {/* ---------------------------------------------------------------- footer */}
      <footer className="border-t-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-soft">
          <div className="flex items-center gap-4">
            <Logo tone="ink" className="w-32" />
            <span>oleh Rubix Technology (M) Sdn Bhd</span>
          </div>
          <div className="flex gap-5 font-semibold text-ink">
            <Link href="/login" className="hover:text-tag">Log masuk</Link>
            {signupOpen ? (
              <Link href="/signup" className="hover:text-tag">Daftar kedai</Link>
            ) : null}
          </div>
        </div>
      </footer>
    </main>
  );
}
