"use client";

import {
  BarChart3, Bell, Building2, ClipboardList, Coins, FileText, Gauge, History, Home, Layers, LayoutDashboard, Map, MessageSquareWarning,
  Package, Plus, Recycle, ScrollText, Settings, ShieldAlert, Star, Tag, Truck, User, Users, Wallet, Wrench, CreditCard, Route,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  home: Home, plus: Plus, list: ClipboardList, history: History, wallet: Wallet, layers: Layers, bell: Bell, user: User, map: Map,
  tag: Tag, truck: Truck, chart: BarChart3, star: Star, card: CreditCard, dash: LayoutDashboard, users: Users, buyers: Package,
  recycle: Recycle, coins: Coins, route: Route, org: Building2, alert: ShieldAlert, review: MessageSquareWarning, settings: Settings,
  audit: ScrollText, gauge: Gauge, file: FileText, wrench: Wrench,
};

export type NavItem = { href: string; icon: keyof typeof ICONS | string; label: string; exact?: boolean; badge?: number };

export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {items.map((i) => {
        const Icon = ICONS[i.icon] ?? Home;
        const active = i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition",
              active ? "bg-eco-500 text-white shadow-sm shadow-eco-500/25" : "text-ink-soft hover:bg-eco-50 hover:text-eco-700",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="truncate">{i.label}</span>
            {!!i.badge && (
              <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-ink">{i.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const t = useTranslations();
  return (
    <nav
      aria-label={t("nav.mobile")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {items.slice(0, 5).map((i) => {
          const Icon = ICONS[i.icon] ?? Home;
          const active = i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/");
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", active ? "text-eco-600" : "text-ink-soft")}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition", active && "bg-eco-100")}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="max-w-full truncate px-1">{i.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
