"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  adminCancelRequestAction, createOrgAction, grantSubscriptionAction, moderateReviewAction, resolveDisputeAction, saveBonusRuleAction,
  saveCategoryAction, saveSettingsAction, setUserStatusAction, verifyBuyerAction,
} from "@/app/actions/admin";
import { useErr } from "@/components/forms/use-err";
import { Button } from "@/components/ui/button";
import { Card, FieldError, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { orgTypeLabel } from "@/lib/format";

function useDo() {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const exec = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) =>
    start(async () => {
      setError(undefined);
      const r = await fn();
      if (r.ok) { if (okMsg) toast.success(okMsg); router.refresh(); } else { setError(err(r.error)); toast.error(err(r.error)); }
    });
  return { t, pending, exec, error };
}

export function UserStatusButton({ id, blocked }: { id: string; blocked: boolean }) {
  const { t, pending, exec } = useDo();
  return <Button size="sm" variant={blocked ? "soft" : "outline"} disabled={pending} onClick={() => exec(() => setUserStatusAction(id, blocked ? "ACTIVE" : "BLOCKED"), blocked ? t("admin.unblocked_ok") : t("admin.blocked_ok"))}>{blocked ? t("admin.unblock") : t("admin.block")}</Button>;
}
export function CancelRequestAdmin({ id }: { id: string }) {
  const { t, pending, exec } = useDo();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => exec(() => adminCancelRequestAction(id), t("admin.request_cancelled"))}>{t("admin.cancel_request")}</Button>;
}
export function VerifyButton({ id, verified }: { id: string; verified: boolean }) {
  const { t, pending, exec } = useDo();
  return <Button size="sm" variant={verified ? "soft" : "outline"} disabled={pending} onClick={() => exec(() => verifyBuyerAction(id, !verified), t("admin.verify_ok"))}>{verified ? t("admin.verified") : t("admin.verify")}</Button>;
}
export function ReviewModerate({ id, hidden }: { id: string; hidden: boolean }) {
  const { t, pending, exec } = useDo();
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => exec(() => moderateReviewAction(id, hidden ? "VISIBLE" : "HIDDEN"), t("admin.review_ok"))}>{hidden ? t("admin.restore") : t("admin.hide")}</Button>;
}
export function SubscriptionControls({ buyerId }: { buyerId: string }) {
  const { t, pending, exec } = useDo();
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" variant="soft" disabled={pending} onClick={() => exec(() => grantSubscriptionAction(buyerId, "TRIAL"), t("admin.sub_done"))}>{t("admin.grant_trial")}</Button>
      <Button size="sm" variant="soft" disabled={pending} onClick={() => exec(() => grantSubscriptionAction(buyerId, "ACTIVE"), t("admin.sub_done"))}>{t("admin.grant_active")}</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => exec(() => grantSubscriptionAction(buyerId, "CANCEL"), t("admin.sub_done"))}>{t("admin.cancel_sub")}</Button>
    </div>
  );
}

export function DisputeResolver({ id }: { id: string }) {
  const { t, pending, exec, error } = useDo();
  const [text, setText] = useState("");
  const go = (d: "RESOLVED_ACCEPT_BUYER" | "RESOLVED_ACCEPT_RESIDENT" | "REJECTED") => exec(() => resolveDisputeAction(id, d, text), t("admin.resolved_ok"));
  return (
    <div className="mt-3 space-y-2">
      <Textarea aria-label={t("admin.resolution")} placeholder={t("admin.resolution")} value={text} onChange={(e) => setText(e.target.value)} />
      <FieldError>{error}</FieldError>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending || text.trim().length < 3} data-testid="resolve-buyer" onClick={() => go("RESOLVED_ACCEPT_BUYER")}>{t("admin.resolve_buyer")}</Button>
        <Button size="sm" variant="dark" disabled={pending || text.trim().length < 3} onClick={() => go("RESOLVED_ACCEPT_RESIDENT")}>{t("admin.resolve_resident")}</Button>
        <Button size="sm" variant="outline" disabled={pending || text.trim().length < 3} onClick={() => go("REJECTED")}>{t("admin.resolve_reject")}</Button>
      </div>
    </div>
  );
}

type CategoryValues = { id?: string; code: string; nameRu: string; nameKg: string; nameEn: string; co2PerKg: string; sortOrder: string; active: boolean };
const EMPTY_CATEGORY: CategoryValues = { id: undefined, code: "", nameRu: "", nameKg: "", nameEn: "", co2PerKg: "0", sortOrder: "", active: true };

export function CategoryForm({ initial }: { initial?: Omit<CategoryValues, "sortOrder"> & { sortOrder: number } }) {
  const { t, pending, exec, error } = useDo();
  const [v, setV] = useState<CategoryValues>(initial ? { ...initial, sortOrder: String(initial.sortOrder) } : EMPTY_CATEGORY);
  // После создания очищаем форму, иначе повторное нажатие «Сохранить» попытается создать дубликат.
  const save = () =>
    exec(async () => {
      const r = await saveCategoryAction({ ...v, sortOrder: v.sortOrder.trim() === "" ? undefined : v.sortOrder });
      if (r.ok && !initial) setV(EMPTY_CATEGORY);
      return r;
    }, t("admin.cat_saved"));
  return (
    <Card className="p-4" data-testid="category-form">
      <div className="grid gap-3 sm:grid-cols-7">
        <div><Label htmlFor={`cc-${v.id ?? "new"}`}>{t("admin.cat_code")}</Label><Input id={`cc-${v.id ?? "new"}`} value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} /></div>
        <div><Label>{t("admin.cat_name_ru")}</Label><Input value={v.nameRu} onChange={(e) => setV({ ...v, nameRu: e.target.value })} /></div>
        <div><Label>{t("admin.cat_name_kg")}</Label><Input value={v.nameKg} onChange={(e) => setV({ ...v, nameKg: e.target.value })} /></div>
        <div><Label>{t("admin.cat_name_en")}</Label><Input value={v.nameEn} onChange={(e) => setV({ ...v, nameEn: e.target.value })} /></div>
        <div><Label>{t("admin.cat_co2")}</Label><Input inputMode="decimal" value={v.co2PerKg} onChange={(e) => setV({ ...v, co2PerKg: e.target.value })} /></div>
        <div><Label>{t("admin.cat_order")}</Label><Input inputMode="numeric" value={v.sortOrder} onChange={(e) => setV({ ...v, sortOrder: e.target.value.replace(/\D/g, "") })} /></div>
        <div className="flex items-end gap-2">
          <label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#168B53]" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />{t("admin.cat_active")}</label>
          <Button disabled={pending} onClick={save}>{t("common.save")}</Button>
        </div>
      </div>
      <FieldError>{error}</FieldError>
    </Card>
  );
}

export function BonusForm({ initial }: { initial: { id: string; name: string; coinsPerKg: string; flatBonus: number; collectiveBonus: number; active: boolean } }) {
  const { t, pending, exec, error } = useDo();
  const [v, setV] = useState(initial);
  return (
    <Card className="p-4">
      <p className="mb-3 font-bold">{initial.name}</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div><Label>{t("admin.coins_per_kg")}</Label><Input inputMode="decimal" value={v.coinsPerKg} onChange={(e) => setV({ ...v, coinsPerKg: e.target.value })} /></div>
        <div><Label>{t("admin.flat")}</Label><Input inputMode="numeric" value={v.flatBonus} onChange={(e) => setV({ ...v, flatBonus: Number(e.target.value) || 0 })} /></div>
        <div><Label>{t("admin.collective_bonus")}</Label><Input inputMode="numeric" value={v.collectiveBonus} onChange={(e) => setV({ ...v, collectiveBonus: Number(e.target.value) || 0 })} /></div>
        <div className="flex items-end gap-2">
          <label className="flex h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[#168B53]" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />{t("admin.cat_active")}</label>
          <Button disabled={pending} onClick={() => exec(() => saveBonusRuleAction({ id: v.id, coinsPerKg: v.coinsPerKg, flatBonus: v.flatBonus, collectiveBonus: v.collectiveBonus, active: v.active }), t("admin.bonus_saved"))}>{t("common.save")}</Button>
        </div>
      </div>
      <FieldError>{error}</FieldError>
    </Card>
  );
}

export function OrgForm() {
  const { t, pending, exec, error } = useDo();
  const [v, setV] = useState({ name: "", type: "SCHOOL", locality: "Кара-Суу" });
  const types = ["SCHOOL", "SHOP", "ENTERPRISE", "AIYL_OKMOTU", "NGO"] as const;
  return (
    <Card className="mb-5 p-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <div><Label htmlFor="on">{t("admin.org_name")}</Label><Input id="on" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div><Label htmlFor="ot">{t("admin.org_type")}</Label>
          <Select id="ot" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>{types.map((k) => <option key={k} value={k}>{orgTypeLabel(t("admin.org_types"), k)}</option>)}</Select></div>
        <div><Label htmlFor="ol">{t("auth.locality")}</Label><Input id="ol" value={v.locality} onChange={(e) => setV({ ...v, locality: e.target.value })} /></div>
        <div className="flex items-end"><Button disabled={pending || v.name.trim().length < 2} onClick={() => exec(() => createOrgAction(v), t("admin.org_created"))}>{t("admin.org_new")}</Button></div>
      </div>
      <FieldError>{error}</FieldError>
    </Card>
  );
}

export function SettingsForm({ rate, date }: { rate: string; date: string }) {
  const { t, pending, exec, error } = useDo();
  const [v, setV] = useState({ usdRate: rate, rateDate: date });
  return (
    <Card className="max-w-xl p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="sr">{t("admin.rate")}</Label><Input id="sr" inputMode="decimal" value={v.usdRate} onChange={(e) => setV({ ...v, usdRate: e.target.value })} /></div>
        <div><Label htmlFor="sd">{t("admin.rate_date")}</Label><Input id="sd" type="date" value={v.rateDate} onChange={(e) => setV({ ...v, rateDate: e.target.value })} /></div>
      </div>
      <FieldError>{error}</FieldError>
      <Button className="mt-4" disabled={pending} onClick={() => exec(() => saveSettingsAction(v), t("admin.settings_saved"))}>{t("common.save")}</Button>
    </Card>
  );
}
