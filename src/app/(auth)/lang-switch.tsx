"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/i18n";
import { useLang, useT } from "@/components/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { lang: Lang; label: string }[] = [
  { lang: "ms", label: "BM" },
  { lang: "en", label: "EN" },
];

/** BM | EN switch on login and signup. Saves the choice in a cookie; a new kedai starts in this language. */
export function LangSwitch() {
  const router = useRouter();
  const current = useLang();
  const t = useT();

  function pick(lang: Lang) {
    if (lang === current) return;
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1 text-sm font-bold" role="group" aria-label={t("Language")}>
      {OPTIONS.map((o, i) => (
        <span key={o.lang} className="flex items-center gap-1">
          {i > 0 ? <span className="text-mute" aria-hidden>|</span> : null}
          <button
            type="button"
            onClick={() => pick(o.lang)}
            aria-pressed={current === o.lang}
            lang={o.lang}
            className={cn(
              "rounded-sm px-1.5 py-0.5",
              current === o.lang ? "bg-cta text-on-cta" : "text-ink-soft hover:text-ink",
            )}
          >
            {o.label}
          </button>
        </span>
      ))}
    </div>
  );
}
