import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-eco-700 via-eco-700 to-eco-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" aria-hidden />
        <div className="absolute -bottom-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-white/5" aria-hidden />
        <Link href="/" className="relative"><Logo light /></Link>
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight">{t("brand.slogan")}</h2>
          <p className="mt-4 max-w-md text-lg text-eco-100">{t("landing.description")}</p>
        </div>
        <p className="relative text-sm text-eco-200">{t("footer.team")}</p>
      </aside>
      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="lg:hidden"><Logo /></Link>
          <span className="hidden lg:block" />
          <LocaleSwitcher />
        </div>
        <div className="mx-auto w-full max-w-md flex-1">{children}</div>
      </main>
    </div>
  );
}
