import { ExternalLink, MapPin, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BuyerDispute, ScheduleForm, WeightForm } from "@/components/buyer/pickup-controls";
import { PageTitle } from "@/components/page-title";
import { DemoBadge, StatusBadge } from "@/components/status-badge";
import { Card, EmptyState } from "@/components/ui/primitives";
import { catName, fmtDate, fmtNum } from "@/lib/format";
import { googleMapsLink, mapsLink } from "@/lib/geo";
import { sumKg } from "@/lib/money";
import { buyerPickups } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function BuyerPickups() {
  const user = await requirePage("BUYER");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const rows = await buyerPickups(user.id, ["SCHEDULED", "AWAITING_CONFIRMATION", "DISPUTED"]);
  const points = rows.map((x) => ({ lat: Number(x.r.lat), lng: Number(x.r.lng) }));
  const totalKg = sumKg(rows.map((x) => x.r.approxWeightKg));
  const toLocal = (d: Date | null) => (d ? new Date(d.getTime() + 6 * 3600000).toISOString().slice(0, 16) : "");

  return (
    <>
      <PageTitle title={t("buyer.pickups_title")} />
      {rows.length === 0 ? <EmptyState title={t("buyer.pickups_empty")} /> : (
        <>
          <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-bold">{t("buyer.route")}: {rows.length} · ≈ {fmtNum(totalKg, locale)} {t("units.kg")}</p>
              <p className="text-xs text-ink-soft">{t("buyer.route_note")}</p>
            </div>
            <a href={googleMapsLink(points)} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-eco-500 px-5 font-semibold text-white hover:bg-eco-600" data-testid="open-route">
              <ExternalLink className="h-4 w-4" aria-hidden />{t("buyer.open_route")}
            </a>
          </Card>
          <ul className="space-y-4">
            {rows.map((x) => (
              <li key={x.p.id}>
                <Card className="p-5" data-testid="pickup-card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold">{catName(x, locale)} · ≈ {fmtNum(x.r.approxWeightKg, locale)} {t("units.kg")}</p>
                      {x.collectionTitle && <p className="text-sm text-eco-700">{x.collectionTitle}</p>}
                    </div>
                    <div className="flex gap-1.5">{x.p.isDemo && <DemoBadge />}<StatusBadge status={x.p.status} /></div>
                  </div>
                  {/* Точные данные доступны только назначенному скупщику. */}
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-eco-500" aria-hidden /><div><dt className="sr-only">{t("buyer.address")}</dt><dd>{x.r.locality}, {x.r.address}</dd></div></div>
                    <div className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 text-eco-500" aria-hidden /><div><dt className="sr-only">{t("buyer.contact")}</dt><dd>{x.residentName} · <a className="font-semibold text-eco-600" href={`tel:${x.residentPhone}`}>{x.residentPhone}</a></dd></div></div>
                    <div className="text-ink-soft">{t("request.pickup_date")}: <b className="text-ink">{fmtDate(x.p.scheduledAt ?? x.r.pickupDate, locale, true)}</b></div>
                    <div className="text-ink-soft">{t("buyer.price_per_kg")}: <b className="text-ink">{x.p.pricePerKg}</b></div>
                  </dl>
                  <div className="mt-4 space-y-3">
                    <a href={mapsLink(Number(x.r.lat), Number(x.r.lng))} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-eco-600 hover:underline">
                      <ExternalLink className="h-4 w-4" aria-hidden />{t("buyer.route")}
                    </a>
                    {x.p.status === "SCHEDULED" && !x.p.collectionId && <ScheduleForm pickupId={x.p.id} current={toLocal(x.p.scheduledAt ?? x.r.pickupDate)} />}
                    {["SCHEDULED", "AWAITING_CONFIRMATION"].includes(x.p.status) && <WeightForm pickupId={x.p.id} pricePerKg={x.p.pricePerKg} />}
                    {x.p.status === "AWAITING_CONFIRMATION" && <p className="text-sm text-amber-700">{t("request.weighed")}: {x.p.reportedWeightKg} {t("units.kg")}</p>}
                    {["SCHEDULED", "AWAITING_CONFIRMATION"].includes(x.p.status) && <BuyerDispute pickupId={x.p.id} />}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
