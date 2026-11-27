import { BuyerProfileForm, VehiclesForm } from "@/components/buyer/forms";
import { ProfileView } from "@/components/profile-view";
import { buyerProfileFull } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function BuyerProfile() {
  const user = await requirePage("BUYER");
  const p = await buyerProfileFull(user.id);
  return (
    <ProfileView user={user}>
      <BuyerProfileForm initial={{ orgName: p.profile?.orgName ?? "", contactPhone: p.profile?.contactPhone ?? "", description: p.profile?.description ?? "", minBatchKg: String(Number(p.profile?.minBatchKg ?? 0)), areas: p.areas }} />
      <VehiclesForm vehicles={p.vehicles.map((v) => ({ id: v.id, name: v.name, capacityKg: v.capacityKg }))} />
    </ProfileView>
  );
}
