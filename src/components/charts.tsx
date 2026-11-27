"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GREEN = "#168B53";
const PALETTE = ["#168B53", "#0B5D38", "#38b27a", "#7cc9a1", "#b45309", "#475569"];

type Row = { label: string; value: number };

export function BarsChart({ data, unit, height = 260 }: { data: Row[]; unit?: string; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe6df" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#4b6156" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#4b6156" }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => [`${v} ${unit ?? ""}`, ""]} cursor={{ fill: "#f1faf5" }} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length] ?? GREEN} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ data, unit, height = 260 }: { data: Row[]; unit?: string; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe6df" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#4b6156" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#4b6156" }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => [`${v} ${unit ?? ""}`, ""]} />
          <Line type="monotone" dataKey="value" stroke={GREEN} strokeWidth={3} dot={{ r: 4, fill: GREEN }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
