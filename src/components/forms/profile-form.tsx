"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfileAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, FieldError, Input, Label, Select } from "@/components/ui/primitives";
import { LOCALITIES } from "@/lib/validation";
import { useErr } from "./use-err";

export function ProfileForm({ initial }: { initial: { name: string; phone: string; locality: string; address: string; language: string } }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card className="max-w-xl p-5">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(undefined);
            const r = await updateProfileAction({ name: v.name, locality: v.locality, address: v.address, language: v.language });
            if (r.ok) { toast.success(t("resident.profile_saved")); router.refresh(); } else setError(err(r.error));
          });
        }}
      >
        <div><Label htmlFor="pn">{t("auth.name")}</Label><Input id="pn" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div><Label htmlFor="pp">{t("auth.phone")}</Label><Input id="pp" value={v.phone} disabled /></div>
        <div><Label htmlFor="pl">{t("auth.locality")}</Label>
          <Select id="pl" value={v.locality} onChange={(e) => setV({ ...v, locality: e.target.value })}>
            {[...new Set([v.locality, ...LOCALITIES])].map((l) => <option key={l}>{l}</option>)}
          </Select></div>
        <div><Label htmlFor="pa">{t("resident.address_label")}</Label><Input id="pa" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></div>
        <div><Label htmlFor="pg">{t("resident.language")}</Label>
          <Select id="pg" value={v.language} onChange={(e) => setV({ ...v, language: e.target.value })}>
            <option value="ru">Русский</option><option value="kg">Кыргызча</option><option value="en">English</option>
          </Select></div>
        <FieldError>{error}</FieldError>
        <Button type="submit" disabled={pending}>{t("common.save")}</Button>
      </form>
    </Card>
  );
}
