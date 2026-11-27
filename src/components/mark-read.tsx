"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { markNotificationsReadAction } from "@/app/actions/resident";
import { Button } from "@/components/ui/button";

export function MarkReadButton() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { await markNotificationsReadAction(); router.refresh(); })}>{t("mark_read")}</Button>;
}
