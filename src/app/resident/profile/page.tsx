import { ProfileView } from "@/components/profile-view";
import { requirePage } from "@/server/session";

export default async function Page() {
  return <ProfileView user={await requirePage("RESIDENT")} />;
}
