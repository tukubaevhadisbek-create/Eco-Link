import { Award } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BarsChart, TrendChart } from "@/components/charts";
import { PageTitle } from "@/components/page-title";
import { Card, EmptyState, StatCard } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { catName, fmtMonth, fmtNum, orgTypeLabel } from "@/lib/format";
import { impactStats, orgRanking } from "@/server/queries";

const MILESTONES = [100, 500, 1000] as const;

/** EcoImpact: только подтверждённые операции; CO₂ — оценка по документированным коэффициентам. */
export async function ImpactView({ withTitle = true }: { withTitle?: boolean }) {
  const [t, locale] = [await getTranslations(), await getLocale()];
  const [s, orgs, cats] = await Promise.all([impactStats(), orgRanking(), db.select().from(schema.materialCategories)]);
  const total = Number(s.totalKg);
  return (
    <>
      {withTitle && <PageTitle title={t("impact.title")} hint={t("impact.hint")} />}
      {s.operations === 0 ? <EmptyState title={t("landing.impact_zero")} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label={t("impact.kg")} value={fmtNum(s.totalKg, locale, 0)} hint={t("units.kg")} />
            <StatCard label={t("impact.participants")} value={s.participants} />
            <StatCard label={t("impact.buyers")} value={s.activeBuyers} />
            <StatCard label={t("impact.ops")} value={s.operations} />
            <StatCard label={t("impact.collections")} value={s.collections} />
            <StatCard label={t("impact.co2")} value={`≈ ${fmtNum(s.co2Kg, locale, 0)}`} hint={t("units.co2")} />
          </div>
          {s.hasDemo && <p className="mt-3 text-sm font-medium text-amber-700">{t("landing.impact_demo")}</p>}
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Card className="p-5"><h2 className="mb-3 font-bold">{t("impact.by_month")}</h2>
              <TrendChart unit={t("units.kg")} data={s.byMonth.map((m) => ({ label: fmtMonth(m.month, locale), value: m.kg }))} /></Card>
            <Card className="p-5"><h2 className="mb-3 font-bold">{t("impact.by_category")}</h2>
              <BarsChart unit={t("units.kg")} data={s.byCategory.map((c) => ({ label: catName(c, locale), value: Math.round(c.kg * 10) / 10 }))} /></Card>
            <Card className="p-5 lg:col-span-2"><h2 className="mb-3 font-bold">{t("impact.by_locality")}</h2>
              <BarsChart height={220} unit={t("units.kg")} data={s.byLocality.map((l) => ({ label: l.locality, value: Math.round(l.kg * 10) / 10 }))} /></Card>
          </div>
          <h2 className="mb-3 mt-8 text-lg font-bold">{t("impact.achievements")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {MILESTONES.map((m) => (
              <Card key={m} className={`flex items-center gap-3 p-4 ${total >= m ? "" : "opacity-50"}`}>
                <Award className={`h-8 w-8 ${total >= m ? "text-amber-500" : "text-ink-soft"}`} aria-hidden />
                <div><p className="font-bold">{t(`impact.ach_${m}`)}</p>{total < m && <p className="text-xs text-ink-soft">{t("impact.ach_locked")}</p>}</div>
              </Card>
            ))}
          </div>
        </>
      )}
      <h2 className="mb-3 mt-8 text-lg font-bold">{t("impact.orgs")}</h2>
      {orgs.length === 0 ? <p className="text-ink-soft">{t("impact.orgs_empty")}</p> : (
        <Card><ol className="divide-y divide-line">
          {orgs.map((o, i) => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <span className="flex items-center gap-3"><b className="grid h-8 w-8 place-items-center rounded-full bg-eco-100 text-eco-700">{i + 1}</b>
                <span><span className="font-semibold">{o.name}</span><span className="block text-xs text-ink-soft">{orgTypeLabel(t("admin.org_types"), o.type)} · {o.locality}</span></span></span>
              <b className="text-eco-700">{fmtNum(o.kg, locale)} {t("units.kg")}</b>
            </li>
          ))}
        </ol></Card>
      )}
      <Card className="mt-6 p-5 text-sm">
        <h2 className="mb-1 font-bold">{t("impact.method")}</h2>
        <p className="text-ink-soft">{t("impact.method_text")}</p>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-ink-soft">
          {cats.map((c) => <li key={c.id}>{catName(c, locale)}: <b>{Number(c.co2PerKg)}</b></li>)}
        </ul>
      </Card>
    </>
  );
}
