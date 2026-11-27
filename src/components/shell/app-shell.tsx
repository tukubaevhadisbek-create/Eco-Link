import { Bell } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import type { User } from "@/db/schema";
import { unreadCount } from "@/server/queries";
import { LocaleSwitcher } from "./locale-switcher";
import { LogoutButton } from "./logout-button";
import { BottomNav, SideNav, type NavItem } from "./nav";

export async function AppShell({
  user, items, notificationsHref, children,
}: {
  user: User;
  items: NavItem[];
  notificationsHref: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations();
  const unread = await unreadCount(user.id);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-white p-5 lg:flex">
        <Link href="/" aria-label="EcoLink"><Logo /></Link>
        <p className="mt-1 text-xs font-medium text-ink-soft">{t(`roles.${user.role}`)}</p>
        <div className="mt-6 flex-1 overflow-y-auto"><SideNav items={items} /></div>
        <div className="mt-4 rounded-2xl bg-eco-50 p-3">
          <p className="truncate text-sm font-bold">{user.name}</p>
          <p className="truncate text-xs text-ink-soft">{user.phone}</p>
          <div className="mt-2 flex items-center justify-between">
            <LocaleSwitcher />
            <LogoutButton compact />
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:px-8">
          <Link href="/" className="lg:hidden" aria-label="EcoLink"><Logo className="[&_svg]:h-7 [&_svg]:w-7 [&_span]:text-lg" /></Link>
          <p className="hidden text-sm font-semibold text-ink-soft lg:block">{t("brand.slogan")}</p>
          <div className="flex items-center gap-2">
            <LocaleSwitcher className="lg:hidden" />
            <Link
              href={notificationsHref}
              aria-label={t("nav.notifications")}
              className="relative grid h-10 w-10 place-items-center rounded-xl text-ink-soft hover:bg-eco-50"
            >
              <Bell className="h-5 w-5" aria-hidden />
              {unread > 0 && (
                <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-ink">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <span className="lg:hidden"><LogoutButton compact /></span>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <BottomNav items={items} />
    </div>
  );
}
