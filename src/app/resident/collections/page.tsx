import { and, eq, isNull } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { CollectionCard } from "@/components/collection-card";
import { CreateCollectionForm, JoinCollection } from "@/components/collection-actions";
import { PageTitle } from "@/components/page-title";
import { EmptyState } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { catName, fmtNum } from "@/lib/format";
import { categories, collectionsOverview } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function ResidentCollections() {
  const user = await requirePage("RESIDENT");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const [cats, all, mine, myReqs] = await Promise.all([
    categories(), collectionsOverview(),
    db.select({ cid: schema.collectiveMemberships.collectionId }).from(schema.collectiveMemberships).where(eq(schema.collectiveMemberships.userId, user.id)),
    db.select().from(schema.recyclingRequests).where(and(eq(schema.recyclingRequests.residentId, user.id), eq(schema.recyclingRequests.status, "AVAILABLE"), isNull(schema.recyclingRequests.collectionId), eq(schema.recyclingRequests.allowCollective, true))),
  ]);
  const joined = new Set(mine.map((m) => m.cid));
  const visible = all.filter((c) => ["OPEN", "TARGET_REACHED"].includes(c.status) || joined.has(c.id));
  return (
    <>
      <PageTitle title={t("collection.title")} hint={t("collection.privacy")} action={<CreateCollectionForm categories={cats.map((c) => ({ id: c.id, name: catName(c, locale) }))} defaultLocality={user.locality} />} />
      {visible.length === 0 ? (
        <EmptyState title={t("collection.empty")} hint={t("collection.empty_hint")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((c) => {
            const opts = myReqs
              .filter((r) => r.categoryId === c.categoryId && r.locality === c.locality)
              .map((r) => ({ id: r.id, label: `${fmtNum(r.approxWeightKg, locale)} ${t("units.kg")} · ${r.address}` }));
            return (
              <CollectionCard key={c.id} c={c} href={`/resident/collections/${c.id}`}
                footer={!joined.has(c.id) && ["OPEN", "TARGET_REACHED"].includes(c.status) ? <JoinCollection collectionId={c.id} options={opts} /> : null} />
            );
          })}
        </div>
      )}
    </>
  );
}
