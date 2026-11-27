import { ClipboardCheck, Scale, Truck, Wallet } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AvailableRequests } from "@/components/buyer/available-requests";
import { PageTitle } from "@/components/page-title";
import { StatCard } from "@/components/ui/primitives";
import { catName, fmtMoney, fmtNum } from "@/lib/format";
import { buyerAnalytics, buyerAvailableRequests, buyerPickups, buyerProfileFull, categories } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function BuyerHome() {
  const user = await requirePage("BUYER");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const [avail, active, an, cats, prof] = await Promise.all([
    buyerAvailableRequests(user.id), buyerPickups(user.id, ["SCHEDULED", "AWAITING_CONFIRMATION", "DISPUTED"]),
    buyerAnalytics(user.id), categories(), buyerProfileFull(user.id),
  ]);
  const items = avail.map((a) => ({
    id: a.id, lat: Number(a.lat), lng: Number(a.lng), locality: a.locality, weight: Number(a.w), code: a.code, categoryId: a.categoryId,
    categoryName: catName(a, locale), inArea: a.inArea, hasPrice: a.hasPrice, estimate: a.estimate,
    pickupDate: a.pickupDate?.toISOString() ?? null, timeFrom: a.timeFrom, timeTo: a.timeTo, description: a.description, isDemo: a.isDemo,
  }));
  const localities = [...new Set(avail.map((a) => a.locality))].sort();
  return (
    <>
      <PageTitle title={t("buyer.dashboard")} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("buyer.kpi_available")} value={items.filter((i) => i.inArea && i.hasPrice).length} icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard label={t("buyer.kpi_active")} value={active.length} icon={<Truck className="h-5 w-5" />} />
        <StatCard label={t("buyer.kpi_kg")} value={fmtNum(an.totalKg, locale)} hint={t("units.kg")} icon={<Scale className="h-5 w-5" />} />
        <StatCard label={t("buyer.kpi_sum")} value={fmtMoney(an.totalAmount, locale)} hint={t("units.som")} icon={<Wallet className="h-5 w-5" />} />
      </div>
      <h2 className="mb-3 text-lg font-bold">{t("buyer.map_title")}</h2>
      <AvailableRequests items={items} localities={localities} categories={cats.map((c) => ({ id: c.id, name: catName(c, locale) }))}
        center={[40.7026, 72.8586]} />
      <p className="mt-3 text-xs text-ink-soft">{prof.areas.length ? `${t("buyer.areas")}: ${prof.areas.join(", ")}` : ""}</p>
    </>
  );
}
