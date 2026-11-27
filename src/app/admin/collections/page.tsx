import { getTranslations } from "next-intl/server";
import { CollectionCard } from "@/components/collection-card";
import { PageTitle } from "@/components/page-title";
import { EmptyState } from "@/components/ui/primitives";
import { collectionsOverview } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function AdminCollections() {
  await requirePage("ADMIN");
  const t = await getTranslations();
  const list = await collectionsOverview();
  return (
    <>
      <PageTitle title={t("admin.collections_title")} />
      {list.length === 0 ? <EmptyState title={t("collection.empty")} /> : <div className="grid gap-4 lg:grid-cols-2">{list.map((c) => <CollectionCard key={c.id} c={c} />)}</div>}
    </>
  );
}
