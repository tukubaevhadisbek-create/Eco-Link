import { ImpactView } from "@/components/impact-view";
import { requirePage } from "@/server/session";

export default async function Page() {
  await requirePage("ADMIN");
  return <ImpactView />;
}
