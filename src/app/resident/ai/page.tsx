import { Info } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/ui/primitives";
import { requirePage } from "@/server/session";

/** Экспериментальный раздел. Рабочей модели распознавания нет, поэтому результатов «ИИ» здесь не показывается. */
export default async function AiPage() {
  await requirePage("RESIDENT");
  const t = await getTranslations("ai");
  return (
    <>
      <PageTitle title={t("title")} />
      <div className="mb-5 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="note">
        <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /><p>{t("disabled")}</p>
      </div>
      <h2 className="mb-3 text-lg font-bold">{t("guide")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["pet", "cardboard", "paper", "aluminum", "metal"] as const).map((k) => <Card key={k} className="p-4">{t(k)}</Card>)}
      </div>
    </>
  );
}
