import { impactStats } from "@/server/queries";
import { audit } from "@/server/audit";
import { db } from "@/db";
import { getCurrentUser } from "@/server/session";

const esc = (v: string | number) => {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // защита от CSV-инъекций формул
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Экспорт только агрегированной статистики (без персональных данных). Доступ: ADMIN. */
export async function GET() {
  const u = await getCurrentUser();
  if (!u) return new Response("Unauthorized", { status: 401 });
  if (u.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const s = await impactStats();
  const lines: (string | number)[][] = [
    ["section", "key", "value_kg_or_count"],
    ["total", "confirmed_kg", s.totalKg],
    ["total", "operations", s.operations],
    ["total", "participants", s.participants],
    ["total", "active_buyers", s.activeBuyers],
    ["total", "collections", s.collections],
    ["total", "estimated_co2_kg", s.co2Kg],
    ...s.byCategory.map((c): (string | number)[] => ["category", c.code, c.kg.toFixed(3)]),
    ...s.byLocality.map((l): (string | number)[] => ["locality", l.locality, l.kg.toFixed(3)]),
    ...s.byMonth.map((m): (string | number)[] => ["month", m.month, m.kg]),
  ];
  await audit(db, u.id, "export.csv", "stats", null);
  const body = "﻿" + lines.map((r) => r.map(esc).join(",")).join("\r\n");
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="ecolink-stats.csv"', "Cache-Control": "no-store" },
  });
}
