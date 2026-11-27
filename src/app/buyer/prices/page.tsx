import { getLocale, getTranslations } from "next-intl/server";
import { PriceRow } from "@/components/buyer/forms";
import { PageTitle } from "@/components/page-title";
import { catName } from "@/lib/format";
import { buyerProfileFull, categories } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function BuyerPrices() {
  const user = await requirePage("BUYER");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const [cats, prof] = await Promise.all([categories(), buyerProfileFull(user.id)]);
  const mine = new Map(prof.prices.map((p) => [p.p.categoryId, p.p]));
  return (
    <>
      <PageTitle title={t("buyer.prices_title")} hint={t("buyer.prices_note")} />
      <div className="space-y-3">
        {cats.map((c) => {
          const p = mine.get(c.id);
          return <PriceRow key={c.id} categoryId={c.id} name={catName(c, locale)} initial={p ? { price: p.pricePerKg, min: String(Number(p.minVolumeKg)), terms: p.terms ?? "" } : undefined} />;
        })}
      </div>
    </>
  );
}
