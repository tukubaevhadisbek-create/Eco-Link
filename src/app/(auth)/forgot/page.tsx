import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ForgotForm } from "@/components/forms/auth-forms";

export default async function ForgotPage() {
  const t = await getTranslations();
  return (
    <div>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{t("auth.forgot_title")}</h1>
      <ForgotForm />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-semibold text-eco-600 hover:underline">{t("auth.login")}</Link></p>
    </div>
  );
}
