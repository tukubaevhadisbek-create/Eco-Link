import { NotificationsView } from "@/components/notifications-list";
import { requirePage } from "@/server/session";

export default async function Page() {
  const u = await requirePage("RESIDENT");
  return <NotificationsView userId={u.id} />;
}
