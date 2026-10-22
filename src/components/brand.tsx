import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The OrderTerus shop mark (awning over a box with a tick), redrawn as a vector so it stays
 * sharp from a 16px favicon up to a hero graphic. Draws in currentColor.
 */
export function BrandMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 8.5h32l10.5 15.5h-53z" strokeWidth="4.2" />
        <path d="M25.5 8.5 23 24M32 8.5V24M38.5 8.5 41 24" strokeWidth="5" />
        <rect x="12.5" y="29" width="39" height="30" rx="11" strokeWidth="6.6" />
        <rect x="22.5" y="37" width="19" height="15" rx="4.5" strokeWidth="3.4" />
        <path d="m27 44.6 3.4 3.3 6.6-6.6" strokeWidth="3.4" />
      </g>
      <circle cx="6.2" cy="26" r="4" fill="currentColor" />
      <circle cx="57.8" cy="26" r="4" fill="currentColor" />
    </svg>
  );
}

/** App-icon style mark: cream shop on a chilli-red rounded square. */
export function BrandIcon({ className }: { className?: string }) {
  return (
    <span className={cn("inline-grid place-items-center rounded-[28%] bg-[#d92d20] text-[#fff4de]", className)}>
      <BrandMark className="size-[68%]" />
    </span>
  );
}

const LOGOS = {
  red: { src: "/brand/logo-red.png", w: 960, h: 230 },
  ink: { src: "/brand/logo-ink.png", w: 894, h: 174 },
  cream: { src: "/brand/logo-cream.png", w: 894, h: 174 },
} as const;

/** The full "orderterus" wordmark from the brand files: red box, or single colour ink / cream. */
export function Logo({ tone = "red", className, priority }: { tone?: keyof typeof LOGOS; className?: string; priority?: boolean }) {
  const l = LOGOS[tone];
  return <Image src={l.src} width={l.w} height={l.h} alt="OrderTerus" className={cn("h-auto", className)} priority={priority} />;
}
