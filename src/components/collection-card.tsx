import { Users } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { DemoBadge, StatusBadge } from "@/components/status-badge";
import { Card, Progress } from "@/components/ui/primitives";
import { catName, fmtDate, fmtNum } from "@/lib/format";
import { percent } from "@/lib/money";

export type CollectionCardData = {
  id: string; title: string; locality: string; status: string; targetKg: string; currentKg: string; members: number;
  plannedDate: Date | null; nameRu: string; nameKg: string; nameEn: string; isDemo: boolean; buyerName?: string | null;
};

/** Карточка коллективного сбора: прогресс, участники, дата, статус. Адресов участников здесь нет. */
export function CollectionCard({ c, href, footer }: { c: CollectionCardData; href?: string; footer?: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const pct = percent(c.currentKg, c.targetKg);
  return (
    <Card className="h-full p-5 transition hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold leading-snug">{href ? <Link href={href} className="hover:text-eco-600 hover:underline">{c.title}</Link> : c.title}</p>
          <p className="text-sm text-ink-soft">{catName(c, locale)} · {c.locality}</p>
        </div>
        <div className="flex gap-1.5">{c.isDemo && <DemoBadge />}<StatusBadge status={c.status} /></div>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-semibold text-eco-700">{fmtNum(c.currentKg, locale)} / {fmtNum(c.targetKg, locale, 0)} {t("units.kg")}</span>
          <span className="font-bold">{pct}%</span>
        </div>
        <Progress value={pct} label={c.title} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden />{c.members} {t("landing.participants")}</span>
        <span>{t("collection.planned")}: {fmtDate(c.plannedDate, locale)}</span>
        {c.buyerName && <span>{t("collection.buyer")}: {c.buyerName}</span>}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </Card>
  );
}
