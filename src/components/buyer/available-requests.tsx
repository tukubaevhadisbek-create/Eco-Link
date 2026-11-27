"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { acceptRequestAction } from "@/app/actions/buyer";
import { useErr } from "@/components/forms/use-err";
import { MapView, type MapPoint } from "@/components/map/map-lazy";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, Select } from "@/components/ui/primitives";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/format";

export type AvailItem = {
  id: string; lat: number; lng: number; locality: string; weight: number; code: string; categoryId: string; categoryName: string;
  inArea: boolean; hasPrice: boolean; estimate: string | null; pickupDate: string | null; timeFrom: string | null; timeTo: string | null;
  description: string | null; isDemo: boolean;
};

export function AvailableRequests({ items, localities, categories, center }: {
  items: AvailItem[]; localities: string[]; categories: { id: string; name: string }[]; center: [number, number];
}) {
  const t = useTranslations();
  const err = useErr();
  const locale = useLocale();
  const router = useRouter();
  const [cat, setCat] = useState("");
  const [loc, setLoc] = useState("");
  const [minKg, setMinKg] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const [, start] = useTransition();

  const list = useMemo(
    () => items.filter((i) => (!cat || i.categoryId === cat) && (!loc || i.locality === loc) && (!minKg || i.weight >= Number(minKg))),
    [items, cat, loc, minKg],
  );
  const points: MapPoint[] = list.map((i) => ({
    kind: "request", id: i.id, lat: i.lat, lng: i.lng, categoryCode: i.code, categoryName: i.categoryName, locality: i.locality, weightKg: i.weight,
  }));

  function accept(id: string) {
    setBusyId(id);
    start(async () => {
      const r = await acceptRequestAction(id);
      setBusyId(undefined);
      if (r.ok) { toast.success(t("buyer.accepted")); router.push("/buyer/pickups"); router.refresh(); }
      else { toast.error(err(r.error)); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3" role="search" aria-label={t("common.search")}>
        <Select aria-label={t("map.filter_category")} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">{t("map.all_categories")}</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select aria-label={t("map.filter_locality")} value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="">{t("map.all_localities")}</option>{localities.map((l) => <option key={l}>{l}</option>)}
        </Select>
        <input aria-label={t("map.filter_min_kg")} placeholder={t("map.filter_min_kg")} inputMode="decimal" value={minKg} onChange={(e) => setMinKg(e.target.value)}
          className="h-11 rounded-xl border border-line bg-white px-3.5 text-[15px] focus:border-eco-500 focus:outline-none focus:ring-4 focus:ring-eco-500/15" />
      </div>

      <MapView
        points={points} center={center} height={380}
        renderAction={(p) => {
          const i = items.find((x) => x.id === p.id);
          return i && i.hasPrice ? (
            <Button size="sm" className="mt-1 w-full" onClick={() => accept(i.id)} disabled={busyId === i.id}>{t("buyer.accept")}</Button>
          ) : null;
        }}
      />

      {list.length === 0 ? (
        <EmptyState icon={<MapPin className="h-6 w-6" />} title={t("buyer.empty")} hint={t("buyer.empty_hint")} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="available-list">
          {list.map((i) => (
            <li key={i.id}>
              <Card className="h-full p-4" data-testid="available-item">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{i.categoryName} · ≈ {fmtNum(i.weight, locale)} {t("units.kg")}</p>
                    <p className="text-sm text-ink-soft">{i.locality} · {fmtDate(i.pickupDate, locale)}{i.timeFrom ? ` ${i.timeFrom}–${i.timeTo}` : ""}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {i.isDemo && <Badge tone="amber">DEMO</Badge>}
                    <Badge tone={i.inArea ? "green" : "gray"}>{i.inArea ? t("buyer.in_area") : t("buyer.out_area")}</Badge>
                  </div>
                </div>
                {i.description && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{i.description}</p>}
                <div className="mt-3 flex items-center justify-between gap-2">
                  {i.estimate ? <p className="text-sm">{t("buyer.estimate")}: <b className="text-eco-700">{fmtMoney(i.estimate, locale)} {t("units.som")}</b></p> : <p className="text-sm text-amber-700">{t("buyer.no_price")}</p>}
                  <Button size="sm" disabled={!i.hasPrice || busyId === i.id} onClick={() => accept(i.id)} data-testid="accept-request">{t("buyer.accept")}</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
