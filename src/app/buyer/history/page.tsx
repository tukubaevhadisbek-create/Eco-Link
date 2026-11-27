import { getLocale, getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { DemoBadge, StatusBadge } from "@/components/status-badge";
import { Card, EmptyState } from "@/components/ui/primitives";
import { catName, fmtDate, fmtMoney, fmtNum } from "@/lib/format";
import { buyerPickups } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function BuyerHistory() {
  const user = await requirePage("BUYER");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const rows = await buyerPickups(user.id, ["COMPLETED", "CANCELLED"]);
  return (
    <>
      <PageTitle title={t("buyer.history_title")} />
      {rows.length === 0 ? <EmptyState title={t("buyer.history_empty")} /> : (
        <Card><ul className="divide-y divide-line">
          {rows.map((x) => (
            <li key={x.p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5" data-testid="buyer-history-item">
              <div>
                <p className="font-semibold">{catName(x, locale)} · {x.p.actualWeightKg ? `${fmtNum(x.p.actualWeightKg, locale)} ${t("units.kg")}` : "—"}</p>
                <p className="text-sm text-ink-soft">{fmtDate(x.p.completedAt ?? x.p.createdAt, locale)} · {x.r.locality}</p>
              </div>
              <div className="flex items-center gap-2">
                {x.p.totalAmount && <b className="text-eco-700">{fmtMoney(x.p.totalAmount, locale)} {t("units.som")}</b>}
                {x.p.isDemo && <DemoBadge />}<StatusBadge status={x.p.status} />
              </div>
            </li>
          ))}
        </ul></Card>
      )}
    </>
  );
}
