"use client";

import { Camera, Info, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createRequestAction, offersAction } from "@/app/actions/resident";
import { LocationPicker } from "@/components/map/map-lazy";
import { Button } from "@/components/ui/button";
import { Badge, Card, FieldError, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { addDraft } from "@/lib/drafts";
import { fmtMoney } from "@/lib/format";
import { LOCALITIES } from "@/lib/validation";
import { useErr } from "./use-err";

type Cat = { id: string; name: string };
type Col = { id: string; title: string; categoryId: string; locality: string };
type Offer = { buyerId: string; name: string; price: string; estimate: string; minVolume: string; terms: string | null; validUntil: string | null; verified: boolean; avg: number | null; n: number };

const KARA_SUU = { lat: 40.7026, lng: 72.8586 };

export function RequestForm({ categories, collections, defaultLocality, userId }: { categories: Cat[]; collections: Col[]; defaultLocality: string; userId: string }) {
  const t = useTranslations();
  const err = useErr();
  const locale = useLocale();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [v, setV] = useState({
    categoryId: categories[0]?.id ?? "", materialType: "", approxWeightKg: "", description: "", locality: defaultLocality,
    address: "", pickupDate: "", timeFrom: "10:00", timeTo: "14:00", desiredPricePerKg: "", allowCollective: false, collectionId: "",
  });
  const [pos, setPos] = useState(KARA_SUU);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; field?: string }>();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  // Живое сравнение предложений (с задержкой, чтобы не слать запрос на каждый символ).
  const weightNorm = v.approxWeightKg.replace(",", ".");
  const weightValid = !!v.categoryId && /^\d+(\.\d+)?$/.test(weightNorm) && Number(weightNorm) > 0;
  useEffect(() => {
    if (!weightValid) return;
    const w = weightNorm;
    const h = setTimeout(async () => {
      const r = await offersAction(v.categoryId, v.locality, w);
      if (r.ok) setOffers(r.offers as Offer[]);
    }, 400);
    return () => clearTimeout(h);
  }, [weightValid, weightNorm, v.categoryId, v.locality]);

  const eligible = useMemo(() => collections.filter((c) => c.categoryId === v.categoryId && c.locality === v.locality), [collections, v.categoryId, v.locality]);
  const collectionId = eligible.some((c) => c.id === v.collectionId) ? v.collectionId : "";

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(undefined);
    const payload = {
      categoryId: v.categoryId, materialType: v.materialType, approxWeightKg: v.approxWeightKg, description: v.description,
      locality: v.locality, address: v.address, lat: pos.lat, lng: pos.lng, pickupDate: v.pickupDate,
      timeFrom: v.timeFrom, timeTo: v.timeTo, desiredPricePerKg: v.desiredPricePerKg || undefined, allowCollective: v.allowCollective,
    };
    // Нет связи: заявка НЕ создаётся, сохраняется только локальный черновик (без фото).
    const saveDraft = () => {
      const ok = addDraft(userId, payload);
      setBusy(false);
      if (ok) toast.warning(t("pwa.draft_saved"), { duration: 8000 }); else toast.error(t("errors.server_error"));
    };
    if (typeof navigator !== "undefined" && !navigator.onLine) return saveDraft();
    const fd = new FormData();
    fd.set("data", JSON.stringify(payload));
    files.forEach((f) => fd.append("photos", f));
    if (v.allowCollective && collectionId) fd.set("collectionId", collectionId);
    let r: Awaited<ReturnType<typeof createRequestAction>>;
    try { r = await createRequestAction(fd); } catch { return saveDraft(); }
    setBusy(false);
    if (r.ok) { toast.success(t("request.created")); router.push("/resident/requests"); router.refresh(); return; }
    setError({ code: r.error, field: r.field });
    toast.error(err(r.error) ?? t("errors.invalid"));
  }
  const fe = (f: string) => (error?.field === f ? err(error.code) : undefined);
  const shownOffers = weightValid ? offers : null;
  const best = shownOffers && shownOffers.length ? shownOffers[0] : null;

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_360px]" data-testid="request-form">
      <div className="space-y-5">
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /><p>{t("request.hazard_note")}</p>
        </div>

        <Card className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cat">{t("request.category")}</Label>
              <Select id="cat" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="mt">{t("request.material_type")} <span className="font-normal text-ink-soft">({t("common.optional")})</span></Label>
              <Input id="mt" value={v.materialType} placeholder={t("request.material_type_ph")} onChange={(e) => set("materialType", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="w">{t("request.weight")}</Label>
              <Input id="w" inputMode="decimal" value={v.approxWeightKg} placeholder="12" onChange={(e) => set("approxWeightKg", e.target.value)} />
              <FieldError>{fe("approxWeightKg")}</FieldError>
            </div>
            <div>
              <Label htmlFor="dp">{t("request.desired_price")} <span className="font-normal text-ink-soft">({t("common.optional")})</span></Label>
              <Input id="dp" inputMode="decimal" value={v.desiredPricePerKg} onChange={(e) => set("desiredPricePerKg", e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="d">{t("request.description")}</Label>
            <Textarea id="d" value={v.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <Label>{t("request.photos")}</Label>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-testid="photo-input"
              onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 3))} />
            <div className="flex flex-wrap gap-3">
              {previews.map((src, i) => (
                <div key={src} className="relative h-20 w-20 overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button type="button" aria-label={t("common.delete")} onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {files.length < 3 && (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="grid h-20 w-20 place-items-center rounded-xl border-2 border-dashed border-line text-ink-soft hover:border-eco-500 hover:text-eco-600">
                  <Camera className="h-6 w-6" aria-hidden /><span className="sr-only">{t("request.photos")}</span>
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-ink-soft">{t("request.photos_count")}</p>
            <FieldError>{error && ["photo_limit", "photo_too_large", "photo_type", "photo_empty"].includes(error.code) ? err(error.code) : undefined}</FieldError>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="loc">{t("request.locality")}</Label>
              <Select id="loc" value={v.locality} onChange={(e) => set("locality", e.target.value)}>
                {LOCALITIES.map((l) => <option key={l}>{l}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="addr">{t("request.address")}</Label>
              <Input id="addr" value={v.address} placeholder={t("request.address_ph")} onChange={(e) => set("address", e.target.value)} />
              <FieldError>{fe("address")}</FieldError>
            </div>
          </div>
          <div>
            <Label>{t("request.point")}</Label>
            <LocationPicker lat={pos.lat} lng={pos.lng} onChange={(lat, lng) => setPos({ lat, lng })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div><Label htmlFor="day">{t("request.day")}</Label><Input id="day" type="date" value={v.pickupDate} onChange={(e) => set("pickupDate", e.target.value)} /></div>
            <div><Label htmlFor="tf">{t("request.time_from")}</Label><Input id="tf" type="time" value={v.timeFrom} onChange={(e) => set("timeFrom", e.target.value)} /></div>
            <div><Label htmlFor="tt">{t("request.time_to")}</Label><Input id="tt" type="time" value={v.timeTo} onChange={(e) => set("timeTo", e.target.value)} /></div>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#168B53]" checked={v.allowCollective} onChange={(e) => set("allowCollective", e.target.checked)} data-testid="allow-collective" />
            <span className="text-sm font-semibold">{t("request.allow_collective")}</span>
          </label>
          {v.allowCollective && (
            eligible.length ? (
              <div>
                <Label htmlFor="col">{t("request.join_collection")}</Label>
                <Select id="col" value={collectionId} onChange={(e) => set("collectionId", e.target.value)}>
                  <option value="">{t("request.no_collection")}</option>
                  {eligible.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </Select>
              </div>
            ) : <p className="text-sm text-ink-soft">{t("collection.no_eligible")}</p>
          )}
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card className="p-5">
          <h2 className="font-bold">{t("request.offers")}</h2>
          {shownOffers === null && <p className="mt-2 text-sm text-ink-soft">{t("request.estimate_note")}</p>}
          {shownOffers && shownOffers.length === 0 && <p className="mt-2 text-sm text-ink-soft">{t("request.offers_empty")}</p>}
          <ul className="mt-3 space-y-3">
            {shownOffers?.map((o, i) => (
              <li key={o.buyerId} className={`rounded-xl border p-3 ${i === 0 ? "border-eco-500 bg-eco-50" : "border-line"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{o.name}</p>
                  {o.verified && <Badge tone="green">✓</Badge>}
                </div>
                <p className="text-sm text-ink-soft">{o.avg ? `★ ${o.avg.toFixed(1)} (${o.n})` : "—"}</p>
                <p className="mt-1 text-sm">{fmtMoney(o.price, locale)} {t("units.som_per_kg")}</p>
                <p className="text-lg font-extrabold text-eco-700">≈ {fmtMoney(o.estimate, locale)} {t("units.som")}</p>
              </li>
            ))}
          </ul>
          {best && <p className="mt-3 text-xs text-ink-soft">{t("request.estimate")}: {t("request.estimate_note")}</p>}
        </Card>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !v.approxWeightKg || !v.address}>
          {busy ? t("common.loading") : t("request.submit")}
        </Button>
        <Button asChild variant="ghost" className="w-full"><Link href="/resident">{t("common.cancel")}</Link></Button>
      </aside>
    </form>
  );
}
