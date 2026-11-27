"use client";

import { useTranslations } from "next-intl";

/** Преобразует код ошибки (из server action или zod) в локализованный текст. */
export function useErr() {
  const t = useTranslations();
  return (code?: string) => {
    if (!code) return undefined;
    const key = `errors.${code}`;
    return t.has(key) ? t(key) : t("errors.invalid");
  };
}
