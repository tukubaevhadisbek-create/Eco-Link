import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/forms/auth-forms";
import { getCurrentUser, homeFor } from "@/server/session";

export default async function LoginPage() {
  const u = await getCurrentUser();
  if (u) redirect(homeFor(u.role));
  const t = await getTranslations();
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">{t("auth.login_title")}</h1>
      <p className="mb-6 mt-2 text-ink-soft">{t("auth.login_hint")}</p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-ink-soft">
        {t("auth.no_account")} <Link href="/register" className="font-semibold text-eco-600 hover:underline">{t("auth.register")}</Link>
      </p>
    </div>
  );
}
