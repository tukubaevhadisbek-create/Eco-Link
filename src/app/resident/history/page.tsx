import { getLocale, getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { ReviewForm } from "@/components/pickup-actions";
import { DemoBadge, StatusBadge } from "@/components/status-badge";
import { Card, EmptyState } from "@/components/ui/primitives";
import { catName, fmtDate, fmtMoney, fmtNum } from "@/lib/format";
import { residentPickups } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function HistoryPage() {
  const user = await requirePage("RESIDENT");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const rows = (await residentPickups(user.id)).filter((x) => ["COMPLETED", "CANCELLED"].includes(x.p.status));
  return (
    <>
      <PageTitle title={t("resident.history_title")} />
      {rows.length === 0 ? <EmptyState title={t("resident.history_empty")} /> : (
        <ul className="space-y-3">
          {rows.map((x) => (
            <li key={x.p.id}>
              <Card className="p-5" data-testid="history-item">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{catName(x, locale)} · {x.p.actualWeightKg ? `${fmtNum(x.p.actualWeightKg, locale)} ${t("units.kg")}` : `≈ ${fmtNum(x.r.approxWeightKg, locale)} ${t("units.kg")}`}</p>
                    <p className="text-sm text-ink-soft">{x.buyerName} · {fmtDate(x.p.completedAt ?? x.p.createdAt, locale)}</p>
                  </div>
                  <div className="flex gap-1.5">{x.p.isDemo && <DemoBadge />}<StatusBadge status={x.p.status} /></div>
                </div>
                {x.p.totalAmount && <p className="mt-2 text-lg font-extrabold text-eco-700">{fmtMoney(x.p.totalAmount, locale)} {t("units.som")}</p>}
                {x.p.status === "COMPLETED" && (
                  <div className="mt-3">
                    {x.review ? <p className="text-sm font-medium text-amber-700">{t("request.reviewed")}: {"★".repeat(x.rating ?? 0)}</p> : <ReviewForm pickupId={x.p.id} />}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
