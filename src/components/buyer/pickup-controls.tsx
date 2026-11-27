"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reportWeightAction, schedulePickupAction } from "@/app/actions/buyer";
import { openDisputeAction } from "@/app/actions/resident";
import { useErr } from "@/components/forms/use-err";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/primitives";
import { fmtDate, fmtMoney } from "@/lib/format";

export function ScheduleForm({ pickupId, current }: { pickupId: string; current: string }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [when, setWhen] = useState(current);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div><Label htmlFor={`sch-${pickupId}`}>{t("buyer.schedule_when")}</Label>
        <Input id={`sch-${pickupId}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-56" /></div>
      <Button variant="soft" disabled={pending || !when}
        onClick={() => start(async () => {
          const r = await schedulePickupAction(pickupId, new Date(when).toISOString());
          if (r.ok) { toast.success(t("buyer.scheduled")); router.refresh(); } else toast.error(err(r.error));
        })}>{t("buyer.schedule")}</Button>
    </div>
  );
}

export function WeightForm({ pickupId, pricePerKg }: { pickupId: string; pricePerKg: string | null }) {
  const t = useTranslations();
  const err = useErr();
  const locale = useLocale();
  const router = useRouter();
  const [w, setW] = useState("");
  const [error, setError] = useState<string>();
  const [issued, setIssued] = useState<{ pin: string; weight: string; amount: string; expiresAt: string }>();
  const [pending, start] = useTransition();
  const preview = pricePerKg && /^\d+([.,]\d+)?$/.test(w) ? (Number(w.replace(",", ".")) * Number(pricePerKg)).toFixed(2) : null;

  if (issued) {
    return (
      <div className="space-y-2 rounded-xl border-2 border-eco-500 bg-eco-50 p-4" role="status" data-testid="pin-issued">
        <p className="text-sm font-semibold">{t("buyer.pin_issued")}</p>
        <p className="font-mono text-4xl font-extrabold tracking-[0.35em] text-eco-700" data-testid="pin-value">{issued.pin}</p>
        <p className="text-sm">{issued.weight} {t("units.kg")} · {t("buyer.amount")}: <b>{fmtMoney(issued.amount, locale)} {t("units.som")}</b></p>
        <p className="text-xs text-ink-soft">{t("buyer.pin_note")} {t("pin.valid_until")} {fmtDate(issued.expiresAt, locale, true)}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(issued.pin); toast.success(t("common.done")); }}><Copy className="h-4 w-4" aria-hidden />PIN</Button>
          <Button size="sm" variant="ghost" onClick={() => { setIssued(undefined); router.refresh(); }}>{t("common.close")}</Button>
        </div>
      </div>
    );
  }
  return (
    <form className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(undefined);
          const r = await reportWeightAction(pickupId, w);
          if (r.ok) setIssued({ pin: r.pin, weight: r.weight, amount: r.amount, expiresAt: r.expiresAt });
          else setError(err(r.error));
        });
      }}>
      <div><Label htmlFor={`w-${pickupId}`}>{t("buyer.actual_weight")}</Label>
        <Input id={`w-${pickupId}`} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} className="w-32" data-testid="actual-weight" /></div>
      {preview && <p className="pb-2.5 text-sm">{t("buyer.amount")}: <b>{fmtMoney(preview, locale)} {t("units.som")}</b></p>}
      <Button type="submit" disabled={pending || !w} data-testid="issue-pin">{t("buyer.issue_pin")}</Button>
      <div className="w-full"><FieldError>{error}</FieldError></div>
    </form>
  );
}

export function BuyerDispute({ pickupId }: { pickupId: string }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (!open) return <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>{t("request.dispute")}</Button>;
  return (
    <div className="w-full space-y-2 rounded-xl border border-line p-3">
      <Textarea value={reason} aria-label={t("request.dispute_reason")} placeholder={t("request.dispute_reason")} onChange={(e) => setReason(e.target.value)} />
      <FieldError>{error}</FieldError>
      <div className="flex gap-2">
        <Button size="sm" variant="danger" disabled={pending}
          onClick={() => start(async () => { const r = await openDisputeAction(pickupId, reason); if (r.ok) { toast.success(t("request.dispute_sent")); router.refresh(); } else setError(err(r.error)); })}>{t("request.dispute")}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}
