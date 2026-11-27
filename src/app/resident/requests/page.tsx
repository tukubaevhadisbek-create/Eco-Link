import { Plus } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { CancelRequestButton, ConfirmPinForm, DisputeButton } from "@/components/pickup-actions";
import { DemoBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { catName, fmtDate, fmtNum } from "@/lib/format";
import { residentPickups, residentRequests } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function MyRequestsPage() {
  const user = await requirePage("RESIDENT");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const [reqs, pickups] = await Promise.all([residentRequests(user.id), residentPickups(user.id)]);
  const byReq = new Map<string, (typeof pickups)[number]>();
  for (const p of pickups) if (p.p.status !== "CANCELLED") byReq.set(p.r.id, p);
  const awaiting = pickups.filter((p) => p.p.status === "AWAITING_CONFIRMATION").map((p) => p.p.id);
  const pending = awaiting.length
    ? await db.select().from(schema.pickupConfirmations).where(and(inArray(schema.pickupConfirmations.pickupId, awaiting), eq(schema.pickupConfirmations.status, "PENDING")))
    : [];
  const confByPickup = new Map(pending.map((c) => [c.pickupId, c]));
  const current = reqs.filter(({ r }) => !["COMPLETED", "CANCELLED"].includes(r.status));

  return (
    <>
      <PageTitle title={t("request.list_title")} action={<Button asChild><Link href="/resident/new"><Plus className="h-4 w-4" aria-hidden />{t("request.new_title")}</Link></Button>} />
      {current.length === 0 ? (
        <EmptyState title={t("request.empty")} hint={t("request.empty_hint")} action={<Button asChild><Link href="/resident/new">{t("request.new_title")}</Link></Button>} />
      ) : (
        <ul className="space-y-4">
          {current.map(({ r, ...c }) => {
            const pk = byReq.get(r.id);
            const conf = pk ? confByPickup.get(pk.p.id) : undefined;
            return (
              <li key={r.id}>
                <Card className="p-5" data-testid="request-card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold">{catName(c, locale)} · ≈ {fmtNum(r.approxWeightKg, locale)} {t("units.kg")}</p>
                      <p className="text-sm text-ink-soft">{r.locality}, {r.address}</p>
                    </div>
                    <div className="flex gap-1.5">{r.isDemo && <DemoBadge />}<StatusBadge status={r.status} /></div>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-ink-soft sm:grid-cols-3">
                    <div><dt className="inline">{t("request.pickup_date")}: </dt><dd className="inline font-medium text-ink">{fmtDate(r.pickupDate, locale)}{r.timeFrom ? ` ${r.timeFrom}–${r.timeTo}` : ""}</dd></div>
                    {pk && <div><dt className="inline">{t("request.buyer_assigned")}: </dt><dd className="inline font-medium text-ink">{pk.buyerName}</dd></div>}
                    {r.agreedPricePerKg && <div><dt className="inline">{t("buyer.price_per_kg")}: </dt><dd className="inline font-medium text-ink">{r.agreedPricePerKg}</dd></div>}
                  </dl>
                  <div className="mt-4 space-y-3">
                    {pk && conf && <ConfirmPinForm pickupId={pk.p.id} weight={conf.actualWeightKg} amount={conf.totalAmount} />}
                    <div className="flex flex-wrap gap-2">
                      {["AVAILABLE", "RESERVED"].includes(r.status) && <CancelRequestButton id={r.id} />}
                      {pk && ["SCHEDULED", "AWAITING_CONFIRMATION"].includes(pk.p.status) && <DisputeButton pickupId={pk.p.id} />}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
