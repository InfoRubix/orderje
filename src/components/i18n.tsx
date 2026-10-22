"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LANG, makeT, type Lang, type T } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; t: T }>({ lang: DEFAULT_LANG, t: makeT(DEFAULT_LANG) });

/** Sets the language for every client component below it (the kedai's language, or the visitor's on login). */
export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
  return (
    <Ctx.Provider value={value}>
      <div lang={lang === "ms" ? "ms" : "en"} className="contents">
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function useT() {
  return useContext(Ctx).t;
}

export function useLang() {
  return useContext(Ctx).lang;
}
