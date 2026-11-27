import { getLocale, getTranslations } from "next-intl/server";
import { CollectionBuyerActions } from "@/components/buyer/forms";
import { CollectionCard } from "@/components/collection-card";
import { PageTitle } from "@/components/page-title";
import { EmptyState } from "@/components/ui/primitives";
import { availableCollectionsForBuyer, buyerProfileFull } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function BuyerCollections() {
  const user = await requirePage("BUYER");
  const t = await getTranslations();
  await getLocale();
  const [list, prof] = await Promise.all([availableCollectionsForBuyer(user.id), buyerProfileFull(user.id)]);
  const hasPrice = new Set(prof.prices.map((p) => p.p.categoryId));
  const minBatch = Number(prof.profile?.minBatchKg ?? 0);
  const toLocal = (d: Date | null) => (d ? new Date(d.getTime() + 6 * 3600000).toISOString().slice(0, 16) : "");
  return (
    <>
      <PageTitle title={t("buyer.collections_title")} hint={t("collection.privacy")} />
      {list.length === 0 ? <EmptyState title={t("buyer.collections_empty")} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((c) => {
            const kg = Number(c.currentKg);
            const ready = hasPrice.has(c.categoryId) && kg > 0 && (kg >= Number(c.targetKg) || (minBatch > 0 && kg >= minBatch));
            return (
              <CollectionCard key={c.id} c={c}
                footer={<CollectionBuyerActions id={c.id} status={c.status} mine={c.buyerId === user.id} canAssign={ready} plannedLocal={toLocal(c.plannedDate)} />} />
            );
          })}
        </div>
      )}
    </>
  );
}
