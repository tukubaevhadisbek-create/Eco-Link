"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { code: "ru", label: "RU" },
  { code: "kg", label: "KG" },
  { code: "en", label: "EN" },
] as const;

export function LocaleSwitcher({ className, dark = false }: { className?: string; dark?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div
      role="group"
      aria-label="Language"
      className={cn("inline-flex rounded-xl p-1", dark ? "bg-white/10" : "bg-eco-50 border border-line", className)}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.code}
          type="button"
          disabled={pending}
          aria-pressed={locale === o.code}
          onClick={() => start(async () => { await setLocaleAction(o.code); router.refresh(); })}
          className={cn(
            "h-8 min-w-9 rounded-lg px-2 text-xs font-bold transition",
            locale === o.code
              ? "bg-eco-500 text-white shadow-sm"
              : dark ? "text-white/80 hover:bg-white/10" : "text-ink-soft hover:bg-white",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
