import { getTranslations } from "next-intl/server";
import { CategoryForm } from "@/components/admin/controls";
import { PageTitle } from "@/components/page-title";
import { allCategories } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function AdminCategories() {
  await requirePage("ADMIN");
  const t = await getTranslations();
  const cats = await allCategories();
  return (
    <>
      <PageTitle title={t("admin.categories_title")} hint={t("request.hazard_note")} />
      <div className="space-y-3">
        {cats.map((c) => <CategoryForm key={c.id} initial={{ id: c.id, code: c.code, nameRu: c.nameRu, nameKg: c.nameKg, nameEn: c.nameEn, co2PerKg: String(Number(c.co2PerKg)), sortOrder: c.sortOrder, active: c.active }} />)}
        <h2 className="pt-4 font-bold">{t("common.create")}</h2>
        <CategoryForm />
      </div>
    </>
  );
}
