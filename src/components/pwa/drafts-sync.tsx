"use client";

import { CloudOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { createRequestAction } from "@/app/actions/resident";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { loadDrafts, markDraftError, removeDraft, type RequestDraft } from "@/lib/drafts";


/** Показывает неотправленные черновики и отправляет их, когда появляется связь. */
export function DraftsSync({ userId }: { userId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const busy = useRef(false);
  // Источник правды — localStorage: подписываемся на наши события и на изменения из других вкладок.
  const raw = useSyncExternalStore(
    (cb) => { window.addEventListener("ecolink:drafts", cb); window.addEventListener("storage", cb); return () => { window.removeEventListener("ecolink:drafts", cb); window.removeEventListener("storage", cb); }; },
    () => localStorage.getItem(`ecolink.drafts.${userId}`) ?? "[]",
    () => "[]",
  );
  const drafts = useMemo<RequestDraft[]>(() => { try { return JSON.parse(raw) as RequestDraft[]; } catch { return []; } }, [raw]);

  const syncAll = useCallback(async () => {
    if (busy.current || !navigator.onLine) return;
    busy.current = true;
    for (const d of loadDrafts(userId)) {
      const fd = new FormData();
      fd.set("data", JSON.stringify(d.data));
      try {
        const r = await createRequestAction(fd);
        if (r.ok) { removeDraft(userId, d.localId); toast.success(t("pwa.synced")); router.refresh(); }
        else markDraftError(userId, d.localId, r.error);
      } catch {
        markDraftError(userId, d.localId, "network");
        break;
      }
    }
    busy.current = false;
  }, [userId, router, t]);

  useEffect(() => {
    const onOnline = () => { void syncAll(); };
    window.addEventListener("online", onOnline);
    if (navigator.onLine) void syncAll();
    return () => window.removeEventListener("online", onOnline);
  }, [syncAll]);

  if (drafts.length === 0) return null;
  return (
    <Card className="mb-5 border-amber-300 bg-amber-50 p-4" data-testid="drafts-panel">
      <p className="flex items-center gap-2 font-bold text-amber-900"><CloudOff className="h-5 w-5" aria-hidden />{t("pwa.drafts_title")}</p>
      <ul className="mt-2 divide-y divide-amber-200">
        {drafts.map((d) => (
          <li key={d.localId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span><b>{t("pwa.draft_unsent")}</b> · ≈ {String(d.data.approxWeightKg)} {t("units.kg")} · {String(d.data.locality)}{d.error ? ` · ${t("pwa.sync_failed")}` : ""}</span>
            <span className="flex gap-2">
              <Button size="sm" disabled={typeof navigator !== "undefined" && !navigator.onLine} onClick={() => void syncAll()}>{t("pwa.send_now")}</Button>
              <Button size="sm" variant="ghost" onClick={() => removeDraft(userId, d.localId)}>{t("pwa.discard")}</Button>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-900">{t("pwa.draft_note")}</p>
    </Card>
  );
}
