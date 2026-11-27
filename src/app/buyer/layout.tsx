import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/shell/app-shell";
import { requirePage } from "@/server/session";

export default async function BuyerLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage("BUYER");
  const t = await getTranslations("nav");
  return (
    <AppShell
      user={user}
      notificationsHref="/buyer/notifications"
      items={[
        { href: "/buyer", icon: "map", label: t("map"), exact: true },
        { href: "/buyer/pickups", icon: "truck", label: t("pickups") },
        { href: "/buyer/collections", icon: "layers", label: t("collections") },
        { href: "/buyer/prices", icon: "tag", label: t("prices") },
        { href: "/buyer/history", icon: "history", label: t("history") },
        { href: "/buyer/analytics", icon: "chart", label: t("analytics") },
        { href: "/buyer/reviews", icon: "star", label: t("reviews") },
        { href: "/buyer/subscription", icon: "card", label: t("subscription") },
        { href: "/buyer/notifications", icon: "bell", label: t("notifications") },
        { href: "/buyer/profile", icon: "user", label: t("profile") },
      ]}
    >
      {children}
    </AppShell>
  );
}
