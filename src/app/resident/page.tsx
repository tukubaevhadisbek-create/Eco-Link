import { Coins, Leaf, PackageCheck, Plus, Scale } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CollectionCard } from "@/components/collection-card";
import { PageTitle } from "@/components/page-title";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, StatCard } from "@/components/ui/primitives";
import { catName, fmtDate, fmtNum } from "@/lib/format";
import { sumKg } from "@/lib/money";
import { collectionsOverview, residentPickups, residentRequests, walletOverview } from "@/server/queries";
import { requirePage } from "@/server/session";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export default async function ResidentDashboard() {
  const user = await requirePage("RESIDENT");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const [reqs, pickups, wallet, mine] = await Promise.all([
    residentRequests(user.id), residentPickups(user.id), walletOverview(user.id),
    db.select({ cid: schema.collectiveMemberships.collectionId }).from(schema.collectiveMemberships).where(eq(schema.collectiveMemberships.userId, user.id)),
  ]);
  const active = reqs.filter((r) => ["AVAILABLE", "RESERVED", "PICKUP_PENDING", "DISPUTED"].includes(r.r.status));
  const done = pickups.filter((p) => p.p.status === "COMPLETED");
  const kgDone = sumKg(done.map((p) => p.p.actualWeightKg ?? "0"));
  const myIds = new Set(mine.map((m) => m.cid));
  const cols = (await collectionsOverview()).filter((c) => myIds.has(c.id)).slice(0, 2);
  const awaiting = pickups.filter((p) => p.p.status === "AWAITING_CONFIRMATION");

  return (
    <>
      <PageTitle
        title={t("resident.greeting", { name: user.name.split(" ")[0] })}
        action={<Button asChild size="lg"><Link href="/resident/new"><Plus className="h-5 w-5" aria-hidden />{t("resident.quick_new")}</Link></Button>}
      />
      {awaiting.length > 0 && (
        <Link href="/resident/requests" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 font-semibold text-amber-900">
          <span>{t("request.weighed")}: {awaiting.length}</span>
          <span className="underline">{t("request.confirm_transfer")}</span>
        </Link>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("resident.kpi_active")} value={active.length} icon={<PackageCheck className="h-5 w-5" />} />
        <StatCard label={t("resident.kpi_done")} value={done.length} icon={<Leaf className="h-5 w-5" />} />
        <StatCard label={t("resident.kpi_kg")} value={fmtNum(kgDone, locale)} icon={<Scale className="h-5 w-5" />} />
        <StatCard label={t("resident.kpi_coins")} value={wallet.balance} icon={<Coins className="h-5 w-5" />} />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">{t("resident.my_collections")}</h2>
        {cols.length === 0 ? (
          <EmptyState title={t("collection.empty")} hint={t("collection.empty_hint")} action={<Button asChild variant="soft"><Link href="/resident/collections">{t("nav.collections")}</Link></Button>} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">{cols.map((c) => <CollectionCard key={c.id} c={c} href={`/resident/collections/${c.id}`} />)}</div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("resident.recent")}</h2>
          <Link href="/resident/requests" className="text-sm font-semibold text-eco-600 hover:underline">{t("common.show_more")}</Link>
        </div>
        {reqs.length === 0 ? (
          <EmptyState title={t("request.empty")} hint={t("request.empty_hint")} action={<Button asChild><Link href="/resident/new">{t("request.new_title")}</Link></Button>} />
        ) : (
          <Card><ul className="divide-y divide-line">
            {reqs.slice(0, 5).map(({ r, ...c }) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                <div>
                  <p className="font-semibold">{catName(c, locale)} · ≈ {fmtNum(r.approxWeightKg, locale)} {t("units.kg")}</p>
                  <p className="text-sm text-ink-soft">{r.locality} · {fmtDate(r.createdAt, locale)}</p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul></Card>
        )}
      </section>
    </>
  );
}
