import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand";
import { Food } from "./food";

/** Striped shop awning with a scalloped edge: the signature graphic, taken from the logo's awning. */
export function Awning({ className, id = "awning" }: { className?: string; id?: string }) {
  return (
    <svg className={cn("block h-7 w-full", className)} preserveAspectRatio="none" aria-hidden>
      <defs>
        <pattern id={id} width="44" height="28" patternUnits="userSpaceOnUse">
          <rect width="22" height="17" fill="#d92d20" />
          <rect x="22" width="22" height="17" fill="#fffbf3" />
          <circle cx="11" cy="17" r="11" fill="#d92d20" />
          <circle cx="33" cy="17" r="11" fill="#fffbf3" />
        </pattern>
      </defs>
      <rect width="100%" height="28" fill={`url(#${id})`} />
    </svg>
  );
}

const MENU = [
  { kind: "nasi" as const, name: "Nasi Lemak Ayam", desc: "Sambal, telur, timun", price: "12.90", qty: 2 },
  { kind: "mee" as const, name: "Mee Goreng Mamak", desc: "Pedas boleh pilih", price: "8.50", qty: 0 },
  { kind: "teh" as const, name: "Teh Tarik", desc: "Panas / ais, kurang manis", price: "3.50", qty: 1 },
];

/** A phone showing the customer's QR menu, drawn in the product's own style. */
export function PhoneMenu({ className, shop = "Warung Pak Din", color = "#d92d20", compact }: { className?: string; shop?: string; color?: string; compact?: boolean }) {
  return (
    <div className={cn("w-[280px] overflow-hidden rounded-[2.4rem] border-[9px] border-[#24211d] bg-[#fff4de] shadow-[0_30px_60px_-30px_rgb(36_33_29/0.55)]", className)}>
      <div className="px-5 pb-4 pt-4 text-white" style={{ background: color }}>
        <div className="flex justify-between text-[10px] font-semibold opacity-80">
          <span>9:41</span>
          <span>You&apos;re at Meja 5</span>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-white/95" style={{ color }}>
            <BrandMark className="size-6" />
          </span>
          <p className="font-display text-[22px] leading-none">{shop}</p>
        </div>
        {!compact ? <p className="mt-2 text-[11px] opacity-90">Sedap sejak 1987, Kampung Baru</p> : null}
      </div>
      <div className="border-b-2 border-[#24211d]" />
      {!compact ? (
        <>
          <div className="flex gap-1.5 px-3 py-2.5 text-[11px] font-semibold">
            <span className="rounded-full border-2 border-[#24211d] bg-[#d92d20] px-2.5 py-0.5 text-[#fff4de]">Nasi &amp; Mee</span>
            <span className="rounded-full border-2 border-[#ecdfc6] bg-[#fffbf3] px-2.5 py-0.5 text-[#57514a]">Roti</span>
            <span className="rounded-full border-2 border-[#ecdfc6] bg-[#fffbf3] px-2.5 py-0.5 text-[#57514a]">Minuman</span>
          </div>
          <ul className="mx-3 divide-y-2 divide-[#ecdfc6] overflow-hidden rounded-xl border-2 border-[#24211d] bg-[#fffbf3]">
            {MENU.map((m) => (
              <li key={m.name} className="flex items-center gap-2.5 px-2.5 py-2">
                <Food kind={m.kind} className="size-12 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-[#24211d]">{m.name}</p>
                  <p className="truncate text-[10.5px] text-[#857d72]">{m.desc}</p>
                  <p className="text-[12px] font-extrabold text-[#d92d20]">RM {m.price}</p>
                </div>
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md border-2 border-[#24211d] text-[11px] font-bold",
                    m.qty ? "bg-[#d92d20] text-[#fff4de]" : "text-[#24211d]",
                  )}
                >
                  {m.qty || "+"}
                </span>
              </li>
            ))}
          </ul>
          <div className="m-3 flex items-center justify-between rounded-xl border-2 border-[#24211d] bg-[#d92d20] px-3.5 py-2.5 text-[12px] font-bold text-[#fff4de]">
            <span>View order (3)</span>
            <span>RM 34.16</span>
          </div>
        </>
      ) : (
        <div className="space-y-2 p-3">
          {MENU.slice(0, 2).map((m) => (
            <div key={m.name} className="flex items-center gap-2 rounded-lg border-2 border-[#24211d] bg-[#fffbf3] p-1.5">
              <Food kind={m.kind} className="size-9 rounded-md" />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-[#24211d]">{m.name}</p>
                <p className="text-[11px] font-extrabold" style={{ color }}>RM {m.price}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The table tent customers scan: "Order sini." with a real, scannable QR. */
export function TableTent({ qrSvg, className }: { qrSvg: string; className?: string }) {
  return (
    <div className={cn("w-[190px] overflow-hidden rounded-xl border-2 border-[#24211d] bg-[#fffbf3] shadow-[0_24px_40px_-24px_rgb(36_33_29/0.6)]", className)}>
      <div className="flex items-center gap-1.5 bg-[#d92d20] px-3 py-2 text-[#fff4de]">
        <BrandMark className="size-5" />
        <span className="text-[13px] font-extrabold tracking-tight">orderterus</span>
      </div>
      <div className="px-3 pb-3 pt-2 text-center">
        <p className="font-display text-[26px] text-[#d92d20]">Order sini.</p>
        <div className="mx-auto mt-1.5 w-[120px] rounded-md border-2 border-[#24211d] bg-white p-1.5 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="mt-1.5 text-[11px] font-bold text-[#24211d]">Meja 5 · Scan, pilih, hantar</p>
      </div>
    </div>
  );
}

/** A kitchen ticket as it lands on the kitchen screen. */
export function KitchenTicket({ className }: { className?: string }) {
  return (
    <div className={cn("w-[210px] rounded-xl border-2 border-[#24211d] bg-[#fffbf3] p-3 shadow-[0_24px_40px_-24px_rgb(36_33_29/0.6)]", className)}>
      <div className="flex items-start justify-between border-b border-dashed border-[#ecdfc6] pb-2">
        <div>
          <p className="font-display text-[30px] leading-none text-[#24211d]">#24</p>
          <p className="mt-1 text-[11px] font-bold text-[#24211d]">Meja 5 · Aisyah</p>
        </div>
        <span className="rounded-sm bg-[#fbead0] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#a8650f]">QR</span>
      </div>
      <ul className="space-y-1 py-2 text-[12px] text-[#24211d]">
        <li className="flex gap-2">
          <b className="w-5">2×</b>
          <span>
            Nasi Lemak Ayam<span className="block text-[10.5px] text-[#857d72]">Telur mata</span>
          </span>
        </li>
        <li className="flex gap-2">
          <b className="w-5">1×</b>
          <span>
            Teh Tarik<span className="block text-[10.5px] text-[#857d72]">Ais, kurang manis</span>
          </span>
        </li>
      </ul>
      <div className="rounded-lg bg-[#d92d20] py-2 text-center text-[12px] font-bold text-[#fff4de]">Start cooking</div>
    </div>
  );
}

/** Thermal receipt with the Malaysian details: service charge, SST and 5-sen rounding. */
export function MiniReceipt({ className }: { className?: string }) {
  const rows: [string, string][] = [
    ["2 × Nasi Lemak Ayam", "25.80"],
    ["1 × Teh Tarik (ais)", "3.50"],
    ["Subtotal", "29.30"],
    ["Service charge 10%", "2.93"],
    ["SST 6%", "1.93"],
    ["Rounding", "-0.01"],
  ];
  return (
    <div className={cn("slip w-[250px] rounded-t-md px-5 pb-6 pt-4 font-mono text-[11.5px] leading-relaxed text-[#24211d]", className)}>
      <div className="flex items-center justify-center gap-1.5 font-sans text-[15px] font-extrabold">
        <BrandMark className="size-5" /> Warung Pak Din
      </div>
      <p className="text-center text-[10.5px] text-[#57514a]">Meja 5 · Dine-in · #24</p>
      <div className="my-2 border-t border-dashed border-[#24211d]/40" />
      {rows.map(([k, v], i) => (
        <p key={k} className={cn("flex justify-between", i === 2 && "mt-1 border-t border-dashed border-[#24211d]/40 pt-1")}>
          <span>{k}</span>
          <span>{v}</span>
        </p>
      ))}
      <p className="mt-1 flex justify-between border-t border-dashed border-[#24211d]/40 pt-1 text-[13px] font-bold">
        <span>TOTAL</span>
        <span>RM 34.15</span>
      </p>
      <p className="mt-1 flex justify-between text-[10.5px] text-[#57514a]">
        <span>Cash RM 50.00</span>
        <span>Change 15.85</span>
      </p>
      <p className="mt-3 text-center font-sans text-[11px] font-bold">Order terus. Senang je.</p>
    </div>
  );
}

/** Sales-by-hour bars for the owner card: lunch and dinner peaks of a typical kedai. */
export function MiniChart({ className }: { className?: string }) {
  const bars = [4, 7, 12, 30, 46, 38, 16, 10, 14, 26, 41, 34, 18];
  const max = Math.max(...bars);
  return (
    <div className={cn("flex h-24 items-end gap-1", className)} aria-hidden>
      {bars.map((b, i) => (
        <span key={i} className={cn("flex-1 rounded-t-[2px]", b === max ? "bg-[#d92d20]" : "bg-[#24211d]")} style={{ height: `${(b / max) * 100}%` }} />
      ))}
    </div>
  );
}
