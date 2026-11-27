import { getLocale, getTranslations } from "next-intl/server";
import { RequestForm } from "@/components/forms/request-form";
import { PageTitle } from "@/components/page-title";
import { catName } from "@/lib/format";
import { categories, collectionsOverview } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function NewRequestPage() {
  const user = await requirePage("RESIDENT");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const [cats, cols] = await Promise.all([categories(), collectionsOverview({ openOnly: true })]);
  return (
    <>
      <PageTitle title={t("request.new_title")} />
      <RequestForm
        categories={cats.map((c) => ({ id: c.id, name: catName(c, locale) }))}
        collections={cols.map((c) => ({ id: c.id, title: c.title, categoryId: c.categoryId, locality: c.locality }))}
        defaultLocality={user.locality}
        userId={user.id}
      />
    </>
  );
}
