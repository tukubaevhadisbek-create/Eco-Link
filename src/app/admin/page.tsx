import { AlertTriangle, ClipboardList, CreditCard, Recycle, Truck, Users } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BarsChart, TrendChart } from "@/components/charts";
import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/primitives";
import { catName, fmtMonth, fmtNum } from "@/lib/format";
import { adminDashboard, impactStats } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function AdminHome() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const [d, s] = await Promise.all([adminDashboard(), impactStats()]);
  return (
    <>
      <PageTitle title={t("admin.dashboard")} action={<Button asChild variant="outline"><a href="/api/admin/export" download>{t("admin.export_csv")}</a></Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="admin-kpis">
        <StatCard label={t("admin.residents")} value={d.users} icon={<Users className="h-5 w-5" />} />
        <StatCard label={t("admin.buyers")} value={d.buyers} icon={<Truck className="h-5 w-5" />} />
        <StatCard label={t("admin.open_requests")} value={d.requestsOpen} hint={`${t("admin.all_requests")}: ${d.requestsTotal}`} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label={t("admin.done")} value={d.pickupsDone} icon={<Recycle className="h-5 w-5" />} />
        <StatCard label={t("admin.disputes")} value={d.openDisputes} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label={t("admin.flagged")} value={d.flaggedReviews} />
        <StatCard label={t("admin.subs")} value={d.activeSubs} icon={<CreditCard className="h-5 w-5" />} />
        <StatCard label={t("impact.kg")} value={fmtNum(s.totalKg, locale, 0)} hint={`${t("units.kg")} · ${t("impact.co2")}: ${fmtNum(s.co2Kg, locale, 0)}`} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card className="p-5"><h2 className="mb-3 font-bold">{t("impact.by_month")}</h2>
          <TrendChart unit={t("units.kg")} data={s.byMonth.map((m) => ({ label: fmtMonth(m.month, locale), value: m.kg }))} /></Card>
        <Card className="p-5"><h2 className="mb-3 font-bold">{t("impact.by_category")}</h2>
          <BarsChart unit={t("units.kg")} data={s.byCategory.map((c) => ({ label: catName(c, locale), value: Math.round(c.kg * 10) / 10 }))} /></Card>
      </div>
      <p className="mt-4 text-sm"><Link className="font-semibold text-eco-600 hover:underline" href="/admin/impact">{t("admin.impact_title")} →</Link></p>
    </>
  );
}
