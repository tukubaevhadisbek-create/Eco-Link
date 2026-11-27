"use client";

import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { toast } from "sonner";

const pin = L.divIcon({
  className: "",
  html: `<div style="background:#168B53;width:34px;height:34px;border-radius:50% 50% 50% 6px;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

function Clicks({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  }, [lat, lng, map]);
  return null;
}

export default function LocationPicker({
  lat, lng, onChange,
}: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
  const t = useTranslations();
  const handlers = useMemo(
    () => ({ dragend(e: L.LeafletEvent) { const p = (e.target as L.Marker).getLatLng(); onChange(p.lat, p.lng); } }),
    [onChange],
  );
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl border border-line" style={{ height: 320 }} data-testid="location-picker">
        <MapContainer center={[lat, lng]} zoom={14} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
          <Clicks onPick={onChange} />
          <Recenter lat={lat} lng={lng} />
          <Marker position={[lat, lng]} icon={pin} draggable eventHandlers={handlers} />
        </MapContainer>
        <button
          type="button"
          onClick={() => {
            if (!navigator.geolocation) return toast.error(t("map.geo_unavailable"));
            navigator.geolocation.getCurrentPosition(
              (p) => onChange(p.coords.latitude, p.coords.longitude),
              () => toast.error(t("map.geo_denied")),
              { enableHighAccuracy: true, timeout: 8000 },
            );
          }}
          className="absolute right-3 top-3 z-[1000] inline-flex h-10 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold shadow-md hover:bg-eco-50"
        >
          <LocateFixed className="h-4 w-4 text-eco-500" aria-hidden /> {t("map.my_location")}
        </button>
      </div>
      <p className="text-xs text-ink-soft">{t("map.pick_hint")}</p>
    </div>
  );
}
