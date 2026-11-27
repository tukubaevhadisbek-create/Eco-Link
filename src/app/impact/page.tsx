import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ImpactView } from "@/components/impact-view";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";

export default async function PublicImpact() {
  const t = await getTranslations();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/"><Logo /></Link><LocaleSwitcher />
      </div></header>
      <main className="mx-auto max-w-6xl px-4 py-8"><h1 className="sr-only">{t("impact.title")}</h1><ImpactView /></main>
    </div>
  );
}
