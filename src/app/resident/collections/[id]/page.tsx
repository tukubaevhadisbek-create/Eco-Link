import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { LeaveCollection } from "@/components/collection-actions";
import { CollectionCard } from "@/components/collection-card";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { fmtNum } from "@/lib/format";
import { collectionDetail } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("RESIDENT");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [t, locale] = [await getTranslations(), await getLocale()];
  const c = await collectionDetail(id);
  if (!c) notFound();
  const [mine] = await db.select().from(schema.collectiveMemberships).where(and(eq(schema.collectiveMemberships.collectionId, id), eq(schema.collectiveMemberships.userId, user.id)));
  return (
    <>
      <PageTitle title={c.title} hint={t("collection.privacy")} />
      {c.status === "TARGET_REACHED" && <div className="mb-4 rounded-2xl bg-eco-100 p-4 font-semibold text-eco-700" role="status">🎉 {t("collection.reached_banner")}</div>}
      <CollectionCard c={{ ...c, members: c.memberCount }} footer={mine && ["OPEN", "TARGET_REACHED"].includes(c.status) ? <LeaveCollection collectionId={id} /> : null} />
      <h2 className="mb-3 mt-8 text-lg font-bold">{t("collection.members")} ({c.memberCount})</h2>
      <Card>
        <ul className="divide-y divide-line">
          {c.members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between px-5 py-3">
              <span className={m.userId === user.id ? "font-bold text-eco-700" : "font-medium"}>{m.name}{m.userId === user.id ? ` (${t("collection.my_membership")})` : ""}</span>
              <span className="text-sm text-ink-soft">
                {t("collection.declared")}: {fmtNum(m.kg, locale)} {t("units.kg")}
                {m.actual ? ` · ${t("collection.actual")}: ${fmtNum(m.actual, locale)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
