/** Flat food illustrations for the landing page mockups (no stock photos). */

type Kind = "nasi" | "mee" | "roti" | "teh" | "kopi";

const PLATES: Record<Exclude<Kind, "teh" | "kopi">, { bg: string; draw: React.ReactNode }> = {
  nasi: {
    bg: "#fde5cc",
    draw: (
      <>
        <ellipse cx="50" cy="56" rx="22" ry="15" fill="#fffaf0" />
        <path d="M60 40c9-2 14 4 11 10-5 5-12 1-11-10z" fill="#c8402e" />
        <circle cx="34" cy="40" r="9" fill="#fff" />
        <circle cx="34" cy="40" r="4" fill="#f5b51e" />
        <g fill="#7fb74a">
          <ellipse cx="66" cy="66" rx="5" ry="3" />
          <ellipse cx="58" cy="72" rx="5" ry="3" />
        </g>
        <g fill="#b9772f">
          <circle cx="40" cy="70" r="2" />
          <circle cx="45" cy="73" r="2" />
          <circle cx="36" cy="66" r="2" />
        </g>
      </>
    ),
  },
  mee: {
    bg: "#fbdcc4",
    draw: (
      <>
        <g fill="none" stroke="#e08a2c" strokeWidth="3.2" strokeLinecap="round">
          <path d="M30 50c6-8 12 8 18 0s12 8 18 0" />
          <path d="M28 58c6-8 12 8 18 0s12 8 18 0s8 6 8 0" />
          <path d="M32 66c6-8 12 8 18 0s12 8 18 0" />
          <path d="M36 42c6-6 10 6 16 0s10 6 14 0" />
        </g>
        <g fill="#c8402e">
          <circle cx="40" cy="47" r="2.6" />
          <circle cx="62" cy="62" r="2.6" />
        </g>
        <circle cx="54" cy="53" r="2.6" fill="#5e9c3c" />
      </>
    ),
  },
  roti: {
    bg: "#fbe9d0",
    draw: (
      <>
        <circle cx="46" cy="54" r="22" fill="#e9b26a" />
        <path d="M46 38c10 0 16 7 16 16s-7 15-16 15-14-6-14-14 6-12 13-12" fill="none" stroke="#f6d39b" strokeWidth="3" />
        <circle cx="70" cy="38" r="9" fill="#d78b2a" />
        <circle cx="70" cy="38" r="6" fill="#f0c04a" />
      </>
    ),
  },
};

const DRINKS = {
  teh: { drink: "#c98a4d", foam: "#f1dcc0", bg: "#f6e4cf" },
  kopi: { drink: "#3b2418", foam: "#6a4630", bg: "#eadcd0" },
};

export function Food({ kind, className }: { kind: Kind; className?: string }) {
  if (kind === "teh" || kind === "kopi") {
    const d = DRINKS[kind];
    return (
      <svg viewBox="0 0 100 100" className={className} aria-hidden>
        <rect width="100" height="100" fill={d.bg} />
        <path d="M33 28h34l-5 52H38z" fill="#fff" opacity=".85" />
        <path d="M35 38h30l-4 40H39z" fill={d.drink} />
        <rect x="35" y="34" width="30" height="7" rx="2" fill={d.foam} />
        <path d="M58 20 52 52" stroke="#28584a" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  const p = PLATES[kind];
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <rect width="100" height="100" fill={p.bg} />
      <circle cx="50" cy="54" r="38" fill="#fff" />
      <circle cx="50" cy="54" r="31" fill="none" stroke="#efe6da" strokeWidth="2" />
      {p.draw}
    </svg>
  );
}
