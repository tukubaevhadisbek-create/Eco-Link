import { getTranslations } from "next-intl/server";
import { SettingsForm } from "@/components/admin/controls";
import { PageTitle } from "@/components/page-title";
import { settingsMap } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function AdminSettings() {
  await requirePage("ADMIN");
  const t = await getTranslations();
  const s = await settingsMap();
  return (
    <>
      <PageTitle title={t("admin.settings_title")} />
      <SettingsForm rate={s.usd_kgs_rate ?? "0"} date={s.usd_kgs_rate_date ?? new Date().toISOString().slice(0, 10)} />
    </>
  );
}
