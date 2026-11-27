"use client";

import L from "leaflet";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { colorFor } from "./categories";

export type MapPoint = {
  kind: "request" | "collection";
  id: string;
  lat: number;
  lng: number;
  categoryCode: string;
  categoryName: string;
  locality: string;
  weightKg: number;
  targetKg?: number;
  members?: number;
  extra?: string;
};

function icon(p: MapPoint) {
  const c = colorFor(p.categoryCode);
  const ring = p.kind === "collection" ? `box-shadow:0 0 0 4px ${c}33;` : "";
  const label = p.kind === "collection" ? "★" : Math.round(p.weightKg).toString();
  return L.divIcon({
    className: "",
    html: `<div style="background:${c};${ring}color:#fff;width:34px;height:34px;border-radius:50% 50% 50% 6px;transform:rotate(-45deg);display:grid;place-items:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"><span style="transform:rotate(45deg);font:700 12px system-ui">${label}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32],
  });
}

function Fit({ points, center }: { points: MapPoint[]; center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])).pad(0.2), { maxZoom: 14 });
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 14);
    else map.setView(center, 12);
  }, [points, center, map]);
  return null;
}

export default function MapView({
  points, center = [40.7026, 72.8586], height = 420, renderAction, ariaLabel,
}: {
  points: MapPoint[];
  center?: [number, number];
  height?: number;
  renderAction?: (p: MapPoint) => React.ReactNode;
  ariaLabel?: string;
}) {
  const t = useTranslations();
  return (
    <div role="region" aria-label={ariaLabel ?? t("map.title")} style={{ height }} className="overflow-hidden rounded-2xl border border-line">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <Fit points={points} center={center} />
        <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
          {points.map((p) => (
            <Marker key={`${p.kind}-${p.id}`} position={[p.lat, p.lng]} icon={icon(p)}>
              <Popup>
                <div className="min-w-48 space-y-1.5 text-[13px]">
                  <p className="text-sm font-bold">{p.kind === "collection" ? t("map.collection") : p.categoryName}</p>
                  <p>{p.kind === "collection" ? `${p.categoryName} · ` : ""}{p.locality}</p>
                  {p.kind === "collection" && p.targetKg ? (
                    <p>{Math.round(p.weightKg)} / {Math.round(p.targetKg)} {t("units.kg")} · {p.members} {t("map.participants")}</p>
                  ) : (
                    <p>≈ {p.weightKg} {t("units.kg")}</p>
                  )}
                  {p.extra && <p className="text-ink-soft">{p.extra}</p>}
                  <p className="text-[11px] text-ink-soft">{t("map.approx_note")}</p>
                  {renderAction?.(p)}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
