"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import { clearAllDrafts } from "@/lib/drafts";
import { Button } from "@/components/ui/button";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size={compact ? "icon" : "sm"}
      disabled={pending}
      aria-label={t("auth.logout")}
      onClick={() => start(async () => { clearAllDrafts(); await logoutAction(); router.push("/"); router.refresh(); })}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      {!compact && <span>{t("auth.logout")}</span>}
    </Button>
  );
}
