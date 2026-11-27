import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/forms/auth-forms";
import { getCurrentUser, homeFor } from "@/server/session";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const u = await getCurrentUser();
  if (u) redirect(homeFor(u.role));
  const { role } = await searchParams;
  const t = await getTranslations();
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">{t("auth.register_title")}</h1>
      <p className="mb-6 mt-2 text-ink-soft">{t("auth.register_hint")}</p>
      <RegisterForm defaultRole={role === "buyer" ? "BUYER" : "RESIDENT"} />
      <p className="mt-6 text-center text-sm text-ink-soft">
        {t("auth.have_account")} <Link href="/login" className="font-semibold text-eco-600 hover:underline">{t("auth.login")}</Link>
      </p>
    </div>
  );
}
