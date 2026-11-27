import { getTranslations } from "next-intl/server";
import { DraftsSync } from "@/components/pwa/drafts-sync";
import { AppShell } from "@/components/shell/app-shell";
import { requirePage } from "@/server/session";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage("RESIDENT");
  const t = await getTranslations("nav");
  return (
    <AppShell
      user={user}
      notificationsHref="/resident/notifications"
      items={[
        { href: "/resident", icon: "home", label: t("dashboard"), exact: true },
        { href: "/resident/new", icon: "plus", label: t("new_request") },
        { href: "/resident/requests", icon: "list", label: t("my_requests") },
        { href: "/resident/collections", icon: "layers", label: t("collections") },
        { href: "/resident/wallet", icon: "wallet", label: t("wallet") },
        { href: "/resident/history", icon: "history", label: t("history") },
        { href: "/resident/ai", icon: "wrench", label: t("ai") },
        { href: "/resident/notifications", icon: "bell", label: t("notifications") },
        { href: "/resident/profile", icon: "user", label: t("profile") },
      ]}
    >
      <DraftsSync userId={user.id} />
      {children}
    </AppShell>
  );
}
