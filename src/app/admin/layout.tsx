import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/shell/app-shell";
import { requirePage } from "@/server/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage("ADMIN");
  const t = await getTranslations("nav");
  return (
    <AppShell
      user={user}
      notificationsHref="/admin/notifications"
      items={[
        { href: "/admin", icon: "dash", label: t("dashboard"), exact: true },
        { href: "/admin/users", icon: "users", label: t("admin_users") },
        { href: "/admin/buyers", icon: "buyers", label: t("admin_buyers") },
        { href: "/admin/requests", icon: "list", label: t("admin_requests") },
        { href: "/admin/collections", icon: "layers", label: t("admin_collections") },
        { href: "/admin/disputes", icon: "alert", label: t("admin_disputes") },
        { href: "/admin/categories", icon: "recycle", label: t("admin_categories") },
        { href: "/admin/prices", icon: "tag", label: t("admin_prices") },
        { href: "/admin/routes", icon: "route", label: t("admin_routes") },
        { href: "/admin/impact", icon: "gauge", label: t("impact") },
        { href: "/admin/subscriptions", icon: "card", label: t("admin_subs") },
        { href: "/admin/bonus", icon: "coins", label: t("admin_bonus") },
        { href: "/admin/organizations", icon: "org", label: t("admin_orgs") },
        { href: "/admin/reviews", icon: "review", label: t("admin_reviews") },
        { href: "/admin/notifications", icon: "bell", label: t("admin_notifications") },
        { href: "/admin/settings", icon: "settings", label: t("admin_settings") },
        { href: "/admin/audit", icon: "audit", label: t("admin_audit") },
      ]}
    >
      {children}
    </AppShell>
  );
}
