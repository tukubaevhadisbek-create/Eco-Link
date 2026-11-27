import { NotificationsView } from "@/components/notifications-list";
import { requirePage } from "@/server/session";

export default async function Page() {
  return <NotificationsView userId={(await requirePage("BUYER")).id} />;
}
