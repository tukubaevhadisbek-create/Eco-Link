"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  assignCollectionAction, deletePriceAction, deleteVehicleAction, demoPaySubscriptionAction, saveBuyerProfileAction, savePriceAction,
  saveVehicleAction, scheduleCollectionAction,
} from "@/app/actions/buyer";
import { flagReviewAction } from "@/app/actions/resident";
import { useErr } from "@/components/forms/use-err";
import { Button } from "@/components/ui/button";
import { Card, FieldError, Input, Label, Textarea } from "@/components/ui/primitives";
import { LOCALITIES } from "@/lib/validation";

export function PriceRow({ categoryId, name, initial }: { categoryId: string; name: string; initial?: { price: string; min: string; terms: string } }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [price, setPrice] = useState(initial?.price ?? "");
  const [min, setMin] = useState(initial?.min ?? "0");
  const [terms, setTerms] = useState(initial?.terms ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card className="p-4" data-testid="price-row">
      <p className="mb-3 font-bold">{name}</p>
      <div className="grid gap-3 sm:grid-cols-[140px_140px_1fr_auto]">
        <div><Label htmlFor={`p-${categoryId}`}>{t("buyer.price_per_kg")}</Label><Input id={`p-${categoryId}`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div><Label htmlFor={`m-${categoryId}`}>{t("buyer.min_volume")}</Label><Input id={`m-${categoryId}`} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} /></div>
        <div><Label htmlFor={`t-${categoryId}`}>{t("buyer.terms")}</Label><Input id={`t-${categoryId}`} value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
        <div className="flex items-end gap-1.5">
          <Button disabled={pending || !price}
            onClick={() => start(async () => {
              setError(undefined);
              const r = await savePriceAction({ categoryId, pricePerKg: price, minVolumeKg: min, terms });
              if (r.ok) { toast.success(t("buyer.price_saved")); router.refresh(); } else setError(err(r.error));
            })}>{t("common.save")}</Button>
          {initial && <Button variant="ghost" size="icon" aria-label={t("common.delete")} disabled={pending}
            onClick={() => start(async () => { await deletePriceAction(categoryId); setPrice(""); router.refresh(); })}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>
      <FieldError>{error}</FieldError>
    </Card>
  );
}

export function BuyerProfileForm({ initial }: { initial: { orgName: string; contactPhone: string; description: string; minBatchKg: string; areas: string[] } }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const toggle = (l: string) => setV((s) => ({ ...s, areas: s.areas.includes(l) ? s.areas.filter((a) => a !== l) : [...s.areas, l] }));
  return (
    <Card className="mt-6 max-w-2xl p-5">
      <h2 className="mb-4 text-lg font-bold">{t("buyer.profile_title")}</h2>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(undefined);
          const r = await saveBuyerProfileAction({ ...v, minBatchKg: v.minBatchKg || "0" });
          if (r.ok) { toast.success(t("common.saved")); router.refresh(); } else setError(err(r.error));
        });
      }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="bo">{t("buyer.org")}</Label><Input id="bo" value={v.orgName} onChange={(e) => setV({ ...v, orgName: e.target.value })} /></div>
          <div><Label htmlFor="bc">{t("buyer.contact_phone")}</Label><Input id="bc" value={v.contactPhone} onChange={(e) => setV({ ...v, contactPhone: e.target.value })} /></div>
        </div>
        <div><Label htmlFor="bd">{t("buyer.about")}</Label><Textarea id="bd" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
        <div><Label htmlFor="bm">{t("buyer.min_batch")}</Label><Input id="bm" inputMode="decimal" value={v.minBatchKg} onChange={(e) => setV({ ...v, minBatchKg: e.target.value })} className="max-w-40" /></div>
        <fieldset><legend className="mb-1.5 text-sm font-semibold">{t("buyer.areas")}</legend>
          <div className="flex flex-wrap gap-2">
            {LOCALITIES.map((l) => (
              <button type="button" key={l} aria-pressed={v.areas.includes(l)} onClick={() => toggle(l)}
                className={`h-9 rounded-full border px-3.5 text-sm font-medium transition ${v.areas.includes(l) ? "border-eco-500 bg-eco-500 text-white" : "border-line bg-white hover:bg-eco-50"}`}>{l}</button>
            ))}
          </div></fieldset>
        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={pending}>{t("common.save")}</Button>
      </form>
    </Card>
  );
}

export function VehiclesForm({ vehicles }: { vehicles: { id: string; name: string; capacityKg: string }[] }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [name, setName] = useState("");
  const [cap, setCap] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card className="mt-6 max-w-2xl p-5">
      <h2 className="mb-3 text-lg font-bold">{t("buyer.vehicles")}</h2>
      <ul className="mb-4 divide-y divide-line">
        {vehicles.map((v) => (
          <li key={v.id} className="flex items-center justify-between py-2.5"><span>{v.name} · {Number(v.capacityKg)} {t("units.kg")}</span>
            <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => start(async () => { await deleteVehicleAction(v.id); router.refresh(); })}><Trash2 className="h-4 w-4" /></Button></li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <div><Label htmlFor="vn">{t("buyer.vehicle_name")}</Label><Input id="vn" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label htmlFor="vc">{t("buyer.capacity")}</Label><Input id="vc" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} className="w-32" /></div>
        <Button disabled={pending || !name || !cap}
          onClick={() => start(async () => {
            const r = await saveVehicleAction({ name, capacityKg: cap });
            if (r.ok) { setName(""); setCap(""); router.refresh(); } else setError(err(r.error));
          })}>{t("buyer.add")}</Button>
      </div>
      <FieldError>{error}</FieldError>
    </Card>
  );
}

export function CollectionBuyerActions({ id, status, mine, canAssign, plannedLocal }: { id: string; status: string; mine: boolean; canAssign: boolean; plannedLocal: string }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [when, setWhen] = useState(plannedLocal);
  const [pending, start] = useTransition();
  if (!mine && ["OPEN", "TARGET_REACHED"].includes(status))
    return <Button disabled={pending || !canAssign} data-testid="assign-collection"
      onClick={() => start(async () => { const r = await assignCollectionAction(id); if (r.ok) { toast.success(t("collection.assigned")); router.refresh(); } else toast.error(err(r.error)); })}>{t("collection.assign")}</Button>;
  if (mine && ["ASSIGNED", "PICKUP_PENDING"].includes(status))
    return (
      <div className="flex flex-wrap items-end gap-2">
        <Input type="datetime-local" aria-label={t("buyer.schedule_when")} value={when} onChange={(e) => setWhen(e.target.value)} className="w-56" />
        <Button variant="soft" disabled={pending || !when}
          onClick={() => start(async () => { const r = await scheduleCollectionAction(id, new Date(when).toISOString()); if (r.ok) { toast.success(t("collection.scheduled")); router.refresh(); } else toast.error(err(r.error)); })}>{t("collection.schedule")}</Button>
      </div>
    );
  return null;
}

export function FlagReviewButton({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => { await flagReviewAction(id); toast.success(t("buyer.flagged")); router.refresh(); })}>{t("buyer.flag")}</Button>;
}

export function DemoPayButton() {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button disabled={pending} data-testid="demo-pay" onClick={() => start(async () => { const r = await demoPaySubscriptionAction(); if (r.ok) { toast.success(t("buyer.sub_paid")); router.refresh(); } })}>{t("buyer.sub_demo_pay")}</Button>;
}
