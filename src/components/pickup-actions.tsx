"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelRequestAction, confirmPickupAction, openDisputeAction, reviewAction } from "@/app/actions/resident";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Textarea } from "@/components/ui/primitives";
import { useErr } from "@/components/forms/use-err";

export function CancelRequestButton({ id }: { id: string }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  if (!ask) return <Button variant="outline" size="sm" onClick={() => setAsk(true)}>{t("request.cancel")}</Button>;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 p-2.5 text-sm" role="alertdialog" aria-label={t("request.cancel_confirm")}>
      <span className="font-medium text-red-900">{t("request.cancel_confirm")}</span>
      <Button size="sm" variant="danger" disabled={pending}
        onClick={() => start(async () => {
          const r = await cancelRequestAction(id);
          if (r.ok) { toast.success(t("request.cancelled")); router.refresh(); } else toast.error(err(r.error));
          setAsk(false);
        })}>{t("common.yes")}</Button>
      <Button size="sm" variant="ghost" onClick={() => setAsk(false)}>{t("common.no")}</Button>
    </div>
  );
}

export function ConfirmPinForm({ pickupId, weight, amount }: { pickupId: string; weight: string; amount: string }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(undefined);
          const r = await confirmPickupAction(pickupId, pin);
          if (r.ok) { toast.success(`${t("request.confirmed")} +${r.coins} ${t("units.coins")}`); router.refresh(); return; }
          setError(r.error === "invalid_pin" && r.attemptsLeft !== undefined ? `${err(r.error)}. ${t("request.attempts_left")}: ${r.attemptsLeft}` : err(r.error));
        });
      }}
    >
      <p className="text-sm font-semibold text-amber-900">{t("request.weighed")}: <b>{weight} {t("units.kg")}</b> · {t("request.pickup_amount")}: <b>{amount} {t("units.som")}</b></p>
      <p className="text-xs text-amber-900">{t("request.pin_hint")}</p>
      <div className="flex gap-2">
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={pin} aria-label={t("request.enter_pin")}
          className="max-w-40 text-center font-mono text-lg tracking-[0.4em]" data-testid="pin-input" onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        <Button type="submit" disabled={pending || pin.length !== 6} data-testid="confirm-pin">{t("request.confirm_transfer")}</Button>
      </div>
      <FieldError>{error}</FieldError>
    </form>
  );
}

export function DisputeButton({ pickupId }: { pickupId: string }) {
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
      <Textarea value={reason} placeholder={t("request.dispute_reason")} aria-label={t("request.dispute_reason")} onChange={(e) => setReason(e.target.value)} />
      <FieldError>{error}</FieldError>
      <div className="flex gap-2">
        <Button size="sm" variant="danger" disabled={pending}
          onClick={() => start(async () => {
            const r = await openDisputeAction(pickupId, reason);
            if (r.ok) { toast.success(t("request.dispute_sent")); router.refresh(); } else setError(err(r.error));
          })}>{t("request.dispute")}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}

export function ReviewForm({ pickupId }: { pickupId: string }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (!open) return <Button variant="soft" size="sm" onClick={() => setOpen(true)}>{t("request.leave_review")}</Button>;
  return (
    <div className="w-full space-y-2 rounded-xl border border-line p-3">
      <div role="radiogroup" aria-label={t("request.rating")} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`} onClick={() => setRating(n)} className="p-1">
            <Star className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-line"}`} />
          </button>
        ))}
      </div>
      <Textarea value={text} placeholder={t("request.review_text")} aria-label={t("request.review_text")} onChange={(e) => setText(e.target.value)} />
      <FieldError>{error}</FieldError>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || rating === 0}
          onClick={() => start(async () => {
            const r = await reviewAction(pickupId, rating, text);
            if (r.ok) { toast.success(t("request.review_sent")); router.refresh(); } else setError(err(r.error));
          })}>{t("common.save")}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}
