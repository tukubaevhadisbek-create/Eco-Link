import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/forms/profile-form";
import { PageTitle } from "@/components/page-title";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";

export async function ProfileView({ user, children }: { user: User; children?: React.ReactNode }) {
  const t = await getTranslations();
  const [p] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, user.id));
  return (
    <>
      <PageTitle title={t("resident.profile_title")} />
      <ProfileForm initial={{ name: user.name, phone: user.phone, locality: user.locality, address: p?.address ?? "", language: user.language }} />
      {children}
    </>
  );
}
