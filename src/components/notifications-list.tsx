import { Bell } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { MarkReadButton } from "@/components/mark-read";
import { PageTitle } from "@/components/page-title";
import { Card, EmptyState } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/format";
import { notificationsFor } from "@/server/queries";

export async function NotificationsView({ userId }: { userId: string }) {
  const [t, locale] = [await getTranslations(), await getLocale()];
  const list = await notificationsFor(userId);
  const unread = list.some((n) => !n.readAt);
  return (
    <>
      <PageTitle title={t("notifications.title")} hint={t("notifications.internal_note")} action={unread ? <MarkReadButton /> : undefined} />
      {list.length === 0 ? <EmptyState icon={<Bell className="h-6 w-6" />} title={t("notifications.empty")} /> : (
        <Card><ul className="divide-y divide-line">
          {list.map((n) => {
            const text = t.has(`notifications.${n.type}`) ? t(`notifications.${n.type}`, n.params as Record<string, string | number>) : n.type;
            const inner = (
              <div className="flex items-start gap-3 px-5 py-3.5">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.readAt ? "bg-line" : "bg-eco-500"}`} aria-label={n.readAt ? undefined : "new"} />
                <div><p className={n.readAt ? "" : "font-semibold"}>{text}</p><p className="text-xs text-ink-soft">{fmtDate(n.createdAt, locale, true)}</p></div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-eco-50">{inner}</Link> : inner}</li>;
          })}
        </ul></Card>
      )}
    </>
  );
}
