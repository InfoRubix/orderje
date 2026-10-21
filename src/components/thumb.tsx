import { cn } from "@/lib/utils";

/** Menu photo, or a soft tile with the item's first letter until the owner uploads one. */
export function ItemThumb({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading="lazy" className={cn("shrink-0 rounded-lg object-cover", className)} />;
  }
  const hue = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-lg font-display text-xl font-bold", className)}
      style={{ background: `hsl(${hue} 55% 88%)`, color: `hsl(${hue} 45% 30%)` }}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

/** Kedai logo, or its first letter on the brand colour. */
export function ShopLogo({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`${name} logo`} className={cn("shrink-0 rounded-xl bg-white object-contain", className)} />;
  }
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-xl bg-white/20 font-display text-2xl font-bold", className)}>
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
