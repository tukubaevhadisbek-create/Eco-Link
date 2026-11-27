import { getLocale, getTranslations } from "next-intl/server";
import { OrgForm } from "@/components/admin/controls";
import { DataTable, Td } from "@/components/admin/table";
import { PageTitle } from "@/components/page-title";
import { DemoBadge } from "@/components/status-badge";
import { fmtNum, orgTypeLabel } from "@/lib/format";
import { orgRanking } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function AdminOrgs() {
  await requirePage("ADMIN");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const rows = await orgRanking();
  return (
    <>
      <PageTitle title={t("admin.orgs_title")} hint={t("impact.orgs")} />
      <OrgForm />
      <DataTable head={["#", t("admin.org_name"), t("admin.org_type"), t("auth.locality"), `${t("impact.kg")}`]}>
        {rows.map((o, i) => (
          <tr key={o.id}><Td>{i + 1}</Td><Td className="font-semibold">{o.name} {o.isDemo && <DemoBadge />}</Td><Td>{orgTypeLabel(t("admin.org_types"), o.type)}</Td><Td>{o.locality}</Td><Td>{fmtNum(o.kg, locale)}</Td></tr>
        ))}
      </DataTable>
      <p className="mt-3 text-xs text-ink-soft">{t("admin.minors_note")}</p>
    </>
  );
}
