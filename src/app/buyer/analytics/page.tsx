import { getLocale, getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { BarsChart, TrendChart } from "@/components/charts";
import { Card, EmptyState, StatCard } from "@/components/ui/primitives";
import { catName, fmtMoney, fmtMonth, fmtNum } from "@/lib/format";
import { buyerAnalytics } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function BuyerAnalytics() {
  const user = await requirePage("BUYER");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const a = await buyerAnalytics(user.id);
  return (
    <>
      <PageTitle title={t("buyer.analytics_title")} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={t("buyer.kpi_kg")} value={fmtNum(a.totalKg, locale)} hint={t("units.kg")} />
        <StatCard label={t("buyer.kpi_sum")} value={fmtMoney(a.totalAmount, locale)} hint={t("units.som")} />
        <StatCard label={t("wallet.ops")} value={a.operations} />
      </div>
      {a.operations === 0 ? <EmptyState title={t("buyer.history_empty")} /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5"><h2 className="mb-3 font-bold">{t("buyer.by_month")}</h2>
            <TrendChart unit={t("units.kg")} data={a.byMonth.map((m) => ({ label: fmtMonth(m.month, locale), value: m.kg }))} /></Card>
          <Card className="p-5"><h2 className="mb-3 font-bold">{t("buyer.by_category")}</h2>
            <BarsChart unit={t("units.kg")} data={a.byCategory.map((c) => ({ label: catName({ nameRu: c.name.ru, nameKg: c.name.kg, nameEn: c.name.en }, locale), value: Math.round(c.kg * 10) / 10 }))} /></Card>
        </div>
      )}
    </>
  );
}
