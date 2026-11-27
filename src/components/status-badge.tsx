import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/primitives";

const TONE: Record<string, "green" | "gray" | "amber" | "red" | "blue" | "violet"> = {
  DRAFT: "gray", AVAILABLE: "green", RESERVED: "blue", PICKUP_PENDING: "amber", COMPLETED: "green", CANCELLED: "gray", DISPUTED: "red",
  OPEN: "green", TARGET_REACHED: "violet", ASSIGNED: "blue", SCHEDULED: "blue", AWAITING_CONFIRMATION: "amber",
  TRIAL: "violet", ACTIVE: "green", EXPIRED: "red", VISIBLE: "green", FLAGGED: "amber", HIDDEN: "gray", BLOCKED: "red",
  RESOLVED_ACCEPT_BUYER: "green", RESOLVED_ACCEPT_RESIDENT: "green", REJECTED: "gray",
};

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  return <Badge tone={TONE[status] ?? "gray"}>{t.has(status) ? t(status) : status}</Badge>;
}

export function DemoBadge() {
  const t = useTranslations("common");
  return <Badge tone="amber" title={t("demo_note")}>{t("demo")}</Badge>;
}
