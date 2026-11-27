import { Coins, Gift } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageTitle } from "@/components/page-title";
import { Badge, Card, EmptyState, StatCard } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/format";
import { walletOverview } from "@/server/queries";
import { requirePage } from "@/server/session";

export default async function WalletPage() {
  const user = await requirePage("RESIDENT");
  const [t, locale] = [await getTranslations(), await getLocale()];
  const w = await walletOverview(user.id);
  return (
    <>
      <PageTitle title={t("wallet.title")} />
      <Card className="mb-5 bg-gradient-to-br from-eco-700 to-eco-500 p-6 text-white">
        <p className="text-sm font-medium text-eco-100">{t("wallet.balance")}</p>
        <p className="mt-1 flex items-baseline gap-2 text-5xl font-extrabold" data-testid="wallet-balance">{w.balance}<span className="text-lg font-semibold text-eco-100">{t("units.coins")}</span></p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("wallet.earned")} value={w.earned} />
        <StatCard label={t("wallet.ops")} value={w.completed} />
        <StatCard label={t("wallet.collective_bonus")} value={w.collectiveBonus} />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">{t("wallet.history")}</h2>
      {w.tx.length === 0 ? <EmptyState icon={<Coins className="h-6 w-6" />} title={t("wallet.empty")} /> : (
        <Card><ul className="divide-y divide-line">
          {w.tx.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div>
                <p className="font-semibold">{x.type === "EARN" ? t("wallet.earn") : t("wallet.spend")} · {t.has(`wallet.reason_${x.reason}`) ? t(`wallet.reason_${x.reason}`) : x.reason}</p>
                <p className="text-sm text-ink-soft">{fmtDate(x.createdAt, locale)} {x.isDemo && <Badge tone="amber">DEMO</Badge>}</p>
              </div>
              <span className={`text-lg font-extrabold ${x.amount > 0 ? "text-eco-600" : "text-danger"}`}>{x.amount > 0 ? "+" : ""}{x.amount}</span>
            </li>
          ))}
        </ul></Card>
      )}
      <h2 className="mb-1 mt-8 text-lg font-bold">{t("wallet.catalog")}</h2>
      <p className="mb-3 text-sm text-ink-soft">{t("wallet.catalog_soon")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {(["reward_1", "reward_2", "reward_3"] as const).map((k) => (
          <Card key={k} className="flex items-center gap-3 p-4 opacity-80">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-eco-50 text-eco-500"><Gift className="h-5 w-5" aria-hidden /></div>
            <div><p className="font-semibold">{t(`wallet.${k}`)}</p><Badge>{t("wallet.coming")}</Badge></div>
          </Card>
        ))}
      </div>
    </>
  );
}
