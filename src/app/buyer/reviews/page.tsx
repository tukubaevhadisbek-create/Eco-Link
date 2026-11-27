import { getLocale, getTranslations } from "next-intl/server";
import { FlagReviewButton } from "@/components/buyer/forms";
import { PageTitle } from "@/components/page-title";
import { StatusBadge } from "@/components/status-badge";
import { Card, EmptyState } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/format";
import { buyerRating } from "@/server/reviews";
import { buyerReviews } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function BuyerReviews() {
  const user = await requirePage("BUYER");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const [list, rating] = await Promise.all([buyerReviews(user.id), buyerRating(user.id)]);
  return (
    <>
      <PageTitle title={t("buyer.reviews_title")} hint={rating.average ? `${t("buyer.rating")}: ★ ${rating.average.toFixed(1)} (${rating.count})` : undefined} />
      {list.length === 0 ? <EmptyState title={t("buyer.reviews_empty")} /> : (
        <ul className="space-y-3">
          {list.map(({ r, name }) => (
            <li key={r.id}><Card className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-bold text-amber-600">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></p>
                  <p className="text-sm text-ink-soft">{name.split(" ")[0]} · {fmtDate(r.createdAt, locale)}</p></div>
                {r.status === "FLAGGED" ? <StatusBadge status="FLAGGED" /> : <FlagReviewButton id={r.id} />}
              </div>
              {r.text && <p className="mt-2">{r.text}</p>}
            </Card></li>
          ))}
        </ul>
      )}
    </>
  );
}
