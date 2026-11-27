import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import ru from "../messages/ru.json";

export const LOCALES = ["ru", "kg", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "ecolink_locale";

export function isLocale(v: string | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

type Tree = { [k: string]: string | Tree };
/** Недостающие ключи берутся из русского текста: английский можно дополнять постепенно. */
function merge(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = typeof v === "object" && typeof b === "object" ? merge(b, v) : v;
  }
  return out;
}

export default getRequestConfig(async () => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(c) ? c : DEFAULT_LOCALE;
  const own = locale === "ru" ? {} : (await import(`../messages/${locale}.json`)).default;
  return { locale, messages: merge(ru as Tree, own as Tree) as never };
});
