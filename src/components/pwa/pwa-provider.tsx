"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};

/** Регистрация service worker (только production) и индикатор соединения. */
export function PwaProvider() {
  const t = useTranslations("pwa");
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) { wasOffline.current = false; toast.success(t("online")); }
  }, [online, t]);

  if (online) return null;
  return (
    <div role="status" data-testid="offline-indicator" className="fixed inset-x-0 top-0 z-[2000] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-sm font-bold text-ink">
      <WifiOff className="h-4 w-4" aria-hidden />{t("offline")}
    </div>
  );
}
