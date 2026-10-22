import { MS } from "./ms";

/**
 * Two languages, English and Bahasa Melayu. The English text in the code is the key: t("Save")
 * looks it up in the Malay dictionary and falls back to the English text if a phrase is missing,
 * so a gap shows English instead of a blank. Placeholders use {name}: t("{n} orders", { n: 3 }).
 */
export type Lang = "en" | "ms";
export const LANGS: Record<Lang, string> = { en: "English", ms: "Bahasa Melayu" };
export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "lang";

export type Params = Record<string, string | number>;

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "ms";
}

function fill(s: string, params?: Params) {
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
}

export function translate(lang: Lang, text: string, params?: Params) {
  return fill(lang === "ms" ? (MS[text] ?? text) : text, params);
}

export function makeT(lang: Lang) {
  return (text: string, params?: Params) => translate(lang, text, params);
}
export type T = ReturnType<typeof makeT>;

/** Intl locale for dates and times. */
export function locale(lang: Lang) {
  return lang === "ms" ? "ms-MY" : "en-MY";
}

/**
 * An error the user can act on. The message is an English template with {placeholders};
 * the params fill it in, so the same error can be shown in either language.
 */
export class UserError extends Error {
  constructor(
    readonly template: string,
    readonly params?: Params,
  ) {
    super(fill(template, params));
  }
  in(lang: Lang) {
    return translate(lang, this.template, this.params);
  }
}
