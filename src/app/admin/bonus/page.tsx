import { getLocale, getTranslations } from "next-intl/server";
import { BonusForm } from "@/components/admin/controls";
import { PageTitle } from "@/components/page-title";
import { db, schema } from "@/db";
import { requirePage } from "@/server/session";

export default async function AdminBonus() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const rules = await db.select().from(schema.bonusRules);
  return (
    <>
      <PageTitle title={t("admin.bonus_title")} hint={t("wallet.catalog_soon")} />
      <div className="space-y-3">
        {rules.map((r) => <BonusForm key={r.id} initial={{ id: r.id, name: locale === "kg" ? r.nameKg : r.nameRu, coinsPerKg: String(Number(r.coinsPerKg)), flatBonus: r.flatBonus, collectiveBonus: r.collectiveBonus, active: r.active }} />)}
      </div>
    </>
  );
}
