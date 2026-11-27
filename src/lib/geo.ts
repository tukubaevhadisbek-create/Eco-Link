import { createHash } from "node:crypto";

/**
 * Публичные координаты: детерминированное смещение до ~±300 м плюс округление.
 * Точные координаты никогда не отдаются публично.
 */
export function publicCoords(lat: number, lng: number, salt: string): { lat: number; lng: number } {
  const h = createHash("sha256").update(`${salt}:${lat.toFixed(5)}:${lng.toFixed(5)}`).digest();
  const dLat = ((h[0] / 255) * 2 - 1) * 0.003; // ≈ ±330 м
  const dLng = ((h[1] / 255) * 2 - 1) * 0.004;
  return {
    lat: Math.round((lat + dLat) * 1000) / 1000,
    lng: Math.round((lng + dLng) * 1000) / 1000,
  };
}

export const KARA_SUU = { lat: 40.7026, lng: 72.8586 };

export function mapsLink(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${lat},${lng}`;
}
export function googleMapsLink(points: { lat: number; lng: number }[]): string {
  if (points.length === 0) return "";
  const dest = points[points.length - 1];
  const way = points.slice(0, -1).map((p) => `${p.lat},${p.lng}`).join("|");
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("destination", `${dest.lat},${dest.lng}`);
  if (way) u.searchParams.set("waypoints", way);
  return u.toString();
}
