"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCollectionAction, joinCollectionAction, leaveCollectionAction } from "@/app/actions/resident";
import { useErr } from "@/components/forms/use-err";
import { Button } from "@/components/ui/button";
import { Card, FieldError, Input, Label, Select } from "@/components/ui/primitives";
import { LOCALITIES } from "@/lib/validation";

export function JoinCollection({ collectionId, options }: { collectionId: string; options: { id: string; label: string }[] }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [sel, setSel] = useState(options[0]?.id ?? "");
  const [pending, start] = useTransition();
  if (options.length === 0) return <p className="text-sm text-ink-soft">{t("collection.no_eligible")}</p>;
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1">
        <Label htmlFor={`pick-${collectionId}`}>{t("collection.pick_request")}</Label>
        <Select id={`pick-${collectionId}`} value={sel} onChange={(e) => setSel(e.target.value)}>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </Select>
      </div>
      <Button disabled={pending || !sel} data-testid="join-collection"
        onClick={() => start(async () => {
          const r = await joinCollectionAction(collectionId, sel);
          if (r.ok) { toast.success(t("collection.joined")); router.refresh(); } else toast.error(err(r.error));
        })}>{t("collection.join")}</Button>
    </div>
  );
}

export function LeaveCollection({ collectionId }: { collectionId: string }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pending}
      onClick={() => start(async () => {
        const r = await leaveCollectionAction(collectionId);
        if (r.ok) { toast.success(t("collection.left")); router.refresh(); } else toast.error(err(r.error));
      })}>{t("collection.leave")}</Button>
  );
}

export function CreateCollectionForm({ categories, defaultLocality }: { categories: { id: string; name: string }[]; defaultLocality: string }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: "", categoryId: categories[0]?.id ?? "", locality: defaultLocality, targetKg: "100", plannedDate: "" });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (!open) return <Button onClick={() => setOpen(true)} data-testid="new-collection"><Plus className="h-4 w-4" aria-hidden />{t("collection.new")}</Button>;
  return (
    <Card className="mb-6 p-5">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(undefined);
            const r = await createCollectionAction(v);
            if (r.ok) { toast.success(t("collection.created")); setOpen(false); router.push(`/resident/collections/${r.id}`); router.refresh(); } else setError(err(r.error));
          });
        }}
      >
        <div className="sm:col-span-2"><Label htmlFor="ct">{t("collection.name")}</Label><Input id="ct" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
        <div><Label htmlFor="cc">{t("request.category")}</Label>
          <Select id="cc" value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
        <div><Label htmlFor="cl">{t("request.locality")}</Label>
          <Select id="cl" value={v.locality} onChange={(e) => setV({ ...v, locality: e.target.value })}>{LOCALITIES.map((l) => <option key={l}>{l}</option>)}</Select></div>
        <div><Label htmlFor="cw">{t("collection.target")}</Label><Input id="cw" inputMode="decimal" value={v.targetKg} onChange={(e) => setV({ ...v, targetKg: e.target.value })} /></div>
        <div><Label htmlFor="cd">{t("collection.planned")}</Label><Input id="cd" type="date" value={v.plannedDate} onChange={(e) => setV({ ...v, plannedDate: e.target.value })} /></div>
        <div className="sm:col-span-2"><FieldError>{error}</FieldError></div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={pending || v.title.trim().length < 3}>{t("common.create")}</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
        </div>
      </form>
    </Card>
  );
}
