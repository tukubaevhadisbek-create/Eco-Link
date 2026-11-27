"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { MapView, type MapPoint } from "@/components/map/map-lazy";
import { Select } from "@/components/ui/primitives";

export type PublicMapPoint = MapPoint & { categoryId: string };

export function PublicMap({ points, categories, localities }: { points: PublicMapPoint[]; categories: { id: string; name: string }[]; localities: string[] }) {
  const t = useTranslations();
  const [cat, setCat] = useState("");
  const [loc, setLoc] = useState("");
  const shown = useMemo(() => points.filter((p) => (!cat || p.categoryId === cat) && (!loc || p.locality === loc)), [points, cat, loc]);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select aria-label={t("map.filter_category")} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">{t("map.all_categories")}</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select aria-label={t("map.filter_locality")} value={loc} onChange={(e) => setLoc(e.target.value)}>
          <option value="">{t("map.all_localities")}</option>{localities.map((l) => <option key={l}>{l}</option>)}
        </Select>
      </div>
      {shown.length === 0 && <p className="text-sm text-ink-soft">{t("map.no_points")}</p>}
      <MapView points={shown} height={460} />
    </div>
  );
}
