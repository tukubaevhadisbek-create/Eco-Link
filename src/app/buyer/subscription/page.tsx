import { getLocale, getTranslations } from "next-intl/server";
import { DemoPayButton } from "@/components/buyer/forms";
import { PageTitle } from "@/components/page-title";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import { hasActiveSubscription } from "@/server/requests";
import { buyerProfileFull, settingsMap } from "@/server/queries";
import { requirePage } from "@/server/session";
import { desc, inArray } from "drizzle-orm";

export default async function SubscriptionPage() {
  const user = await requirePage("BUYER");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const [p, s, active] = await Promise.all([buyerProfileFull(user.id), settingsMap(), hasActiveSubscription(db, user.id)]);
  const current = p.subscriptions[0];
  const events = p.subscriptions.length
    ? await db.select().from(schema.subscriptionEvents).where(inArray(schema.subscriptionEvents.subscriptionId, p.subscriptions.map((x) => x.id))).orderBy(desc(schema.subscriptionEvents.createdAt))
    : [];
  const rate = Number(s.usd_kgs_rate ?? 0);
  const price = Number(s.subscription_price_usd ?? 10);
  return (
    <>
      <PageTitle title={t("buyer.sub_title")} />
      <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{t("buyer.sub_demo_note")}</div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <p className="text-sm text-ink-soft">{t("buyer.sub_price")}</p>
          <p className="text-4xl font-extrabold text-eco-700">${price.toFixed(2)}<span className="text-base font-medium text-ink-soft"> / 30</span></p>
          {rate > 0 && <p className="mt-1 text-sm text-ink-soft">{t("buyer.sub_equiv")}: ≈ {fmtMoney(price * rate, locale)} {t("units.som")} ({rate} · {s.usd_kgs_rate_date})</p>}
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">{t("buyer.sub_status")}</dt><dd>{current ? <StatusBadge status={active ? current.status : "EXPIRED"} /> : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">{t("buyer.sub_start")}</dt><dd className="font-semibold">{fmtDate(current?.startsAt, locale)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">{t("buyer.sub_end")}</dt><dd className="font-semibold">{fmtDate(current?.endsAt, locale)}</dd></div>
          </dl>
          <div className="mt-5"><DemoPayButton /></div>
        </Card>
        <Card className="p-6">
          <h2 className="mb-3 font-bold">{t("buyer.sub_events")}</h2>
          <ul className="divide-y divide-line text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between py-2.5"><span>{e.type}{e.isDemo ? " · DEMO" : ""}</span><span className="text-ink-soft">{e.amountUsd ? `$${e.amountUsd} · ` : ""}{fmtDate(e.createdAt, locale)}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
