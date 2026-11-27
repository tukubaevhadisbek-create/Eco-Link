import { ArrowRight, Banknote, BellRing, Box, CircleDollarSign, Cylinder, FileText, Leaf, MapPinned, Milk, Recycle, Route, ScanLine, ShieldCheck, Truck, Users, Wrench } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CollectionCard } from "@/components/collection-card";
import { PublicMap } from "@/components/landing/public-map";
import { Logo } from "@/components/logo";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { catName, fmtNum } from "@/lib/format";
import { allCategories, categories, collectionsOverview, impactStats, publicMapPoints } from "@/server/queries";
import { getCurrentUser, homeFor } from "@/server/session";

const CAT_ICON: Record<string, React.ReactNode> = {
  PET: <Milk className="h-6 w-6" />, PLASTIC_OTHER: <Recycle className="h-6 w-6" />, CARDBOARD: <Box className="h-6 w-6" />,
  PAPER: <FileText className="h-6 w-6" />, ALUMINUM: <Cylinder className="h-6 w-6" />, METAL: <Wrench className="h-6 w-6" />,
};

export default async function Landing() {
  const [t, locale, user] = [await getTranslations(), await getLocale(), await getCurrentUser()];
  const [cats, cols, points, impact, everyCat] = await Promise.all([categories(), collectionsOverview({ openOnly: true }), publicMapPoints(), impactStats(), allCategories()]);
  // Подписи берём по всем категориям: у точки на карте категория могла быть отключена позже, и тогда вместо названия показывался бы технический код.
  const catName_ = new Map(everyCat.map((c) => [c.id, catName(c, locale)]));
  const mapPoints = points.map((p) => ({ ...p, categoryName: catName_.get(p.categoryId) ?? p.categoryCode }));
  const localities = [...new Set(points.map((p) => p.locality))].sort();
  const faq = [1, 2, 3, 4, 5] as const;
  const resBenefits = [1, 2, 3, 4] as const;

  return (
    <div className="bg-surface">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="EcoLink"><Logo /></Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-ink-soft md:flex" aria-label="Main">
            <a href="#how" className="hover:text-eco-600">{t("landing.how_title")}</a>
            <a href="#collective" className="hover:text-eco-600">{t("landing.collective_title")}</a>
            <a href="#map" className="hover:text-eco-600">{t("landing.map_title")}</a>
            <a href="#faq" className="hover:text-eco-600">{t("landing.faq_title")}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            {user ? <Button asChild size="sm"><Link href={homeFor(user.role)}>{t("landing.cta_cabinet")}</Link></Button>
              : <Button asChild size="sm" variant="outline"><Link href="/login">{t("auth.login")}</Link></Button>}
          </div>
        </div>
      </header>

      <div className="bg-amber-50 py-2 text-center text-xs font-medium text-amber-900">{t("landing.demo_banner")}</div>

      <section className="relative overflow-hidden bg-gradient-to-br from-eco-700 via-eco-700 to-eco-500 text-white">
        <div className="absolute -right-28 -top-28 h-[28rem] w-[28rem] rounded-full bg-white/5" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.2fr_1fr] lg:py-24">
          <div>
            <Logo light className="mb-6 [&_svg]:h-12 [&_svg]:w-12 [&_span]:text-3xl" />
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{t("brand.slogan")}</h1>
            <p className="mt-5 max-w-xl text-lg text-eco-100">{t("landing.description")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-white !text-eco-700 hover:bg-eco-50"><Link href="/register?role=resident" data-testid="cta-resident">{t("landing.cta_resident")}<ArrowRight className="h-5 w-5" aria-hidden /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent !text-white hover:bg-white/10"><Link href="/register?role=buyer" data-testid="cta-buyer">{t("landing.cta_buyer")}</Link></Button>
            </div>
          </div>
          <Card className="self-center border-white/20 bg-white/10 p-6 text-white backdrop-blur">
            <p className="mb-1 text-sm font-semibold text-eco-100">EcoImpact</p>
            {impact.operations === 0 ? <p>{t("landing.impact_zero")}</p> : (
              <dl className="grid grid-cols-2 gap-5">
                <div><dd className="text-3xl font-extrabold" data-testid="impact-kg">{fmtNum(impact.totalKg, locale, 0)}</dd><dt className="text-sm text-eco-100">{t("landing.impact_kg")}</dt></div>
                <div><dd className="text-3xl font-extrabold">{impact.operations}</dd><dt className="text-sm text-eco-100">{t("landing.impact_ops")}</dt></div>
                <div><dd className="text-3xl font-extrabold">{impact.participants}</dd><dt className="text-sm text-eco-100">{t("landing.impact_people")}</dt></div>
                <div><dd className="text-3xl font-extrabold">{fmtNum(impact.co2Kg, locale, 0)}</dd><dt className="text-sm text-eco-100">{t("landing.impact_co2")}</dt></div>
              </dl>
            )}
            {impact.hasDemo && <p className="mt-4 text-xs text-eco-100">{t("landing.impact_demo")}</p>}
          </Card>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-extrabold tracking-tight">{t("landing.how_title")}</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([1, 2, 3, 4] as const).map((n, i) => (
            <li key={n}><Card className="h-full p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-eco-500 font-extrabold text-white">{n}</span>
              <p className="mt-3 font-bold">{t(`landing.how_${n}_t`)}</p>
              <p className="mt-1 text-sm text-ink-soft">{t(`landing.how_${n}_d`)}</p>
              <span className="sr-only">{i}</span>
            </Card></li>
          ))}
        </ol>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-extrabold tracking-tight">{t("landing.categories_title")}</h2>
          <p className="mt-2 text-ink-soft">{t("landing.categories_hint")}</p>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {cats.map((c) => (
              <Card key={c.id} className="flex flex-col items-center p-5 text-center transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-eco-50 text-eco-500">{CAT_ICON[c.code] ?? <Leaf className="h-6 w-6" />}</span>
                <p className="mt-3 text-sm font-bold">{catName(c, locale)}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 md:grid-cols-2">
        <Card className="p-7">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold"><Users className="h-6 w-6 text-eco-500" aria-hidden />{t("landing.res_title")}</h2>
          <ul className="mt-4 space-y-3">{resBenefits.map((n) => <li key={n} className="flex gap-3"><CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-eco-500" aria-hidden />{t(`landing.res_${n}`)}</li>)}</ul>
        </Card>
        <Card className="p-7">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold"><Truck className="h-6 w-6 text-eco-500" aria-hidden />{t("landing.buy_title")}</h2>
          <ul className="mt-4 space-y-3">{([1, 2, 3, 4] as const).map((n) => <li key={n} className="flex gap-3"><Route className="mt-0.5 h-5 w-5 shrink-0 text-eco-500" aria-hidden />{t(`landing.buy_${n}`)}</li>)}</ul>
        </Card>
      </section>

      <section id="collective" className="bg-eco-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-extrabold tracking-tight">{t("landing.collective_title")}</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">{t("landing.collective_hint")}</p>
          {cols.length === 0 ? <p className="mt-6 text-ink-soft">{t("landing.collective_empty")}</p> : (
            <div className="mt-8 grid gap-4 md:grid-cols-2">{cols.slice(0, 4).map((c) => <CollectionCard key={c.id} c={c} />)}</div>
          )}
        </div>
      </section>

      <section id="map" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight"><MapPinned className="h-7 w-7 text-eco-500" aria-hidden />{t("landing.map_title")}</h2>
        <p className="mb-6 mt-2 flex items-start gap-2 text-ink-soft"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-eco-500" aria-hidden />{t("landing.map_hint")}</p>
        <PublicMap points={mapPoints} localities={localities} categories={cats.map((c) => ({ id: c.id, name: catName(c, locale) }))} />
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-extrabold tracking-tight">{t("landing.impact_title")}</h2>
          {impact.operations === 0 ? <p className="mt-4 text-ink-soft">{t("landing.impact_zero")}</p> : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[[fmtNum(impact.totalKg, locale, 0), t("landing.impact_kg"), <Leaf key="a" className="h-5 w-5" />], [impact.operations, t("landing.impact_ops"), <ScanLine key="b" className="h-5 w-5" />],
                [impact.participants, t("landing.impact_people"), <Users key="c" className="h-5 w-5" />], [fmtNum(impact.co2Kg, locale, 0), t("landing.impact_co2"), <BellRing key="d" className="h-5 w-5" />]].map(([v, l, i], k) => (
                <Card key={k} className="p-5"><span className="text-eco-500">{i}</span><p className="mt-2 text-3xl font-extrabold text-eco-700">{v}</p><p className="text-sm text-ink-soft">{l}</p></Card>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-ink-soft">{t("landing.impact_note")} {impact.hasDemo && t("landing.impact_demo")}</p>
          <Button asChild variant="soft" className="mt-4"><Link href="/impact">{t("impact.title")}<ArrowRight className="h-4 w-4" aria-hidden /></Link></Button>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-3xl font-extrabold tracking-tight">{t("landing.faq_title")}</h2>
        <div className="mt-6 space-y-3">
          {faq.map((n) => (
            <details key={n} className="group rounded-2xl border border-line bg-white p-5 open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">{t(`landing.faq_${n}_q`)}<span className="text-eco-500 transition group-open:rotate-45" aria-hidden>+</span></summary>
              <p className="mt-3 text-ink-soft">{t(`landing.faq_${n}_a`)}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="bg-eco-900 py-12 text-eco-100">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[1.4fr_1fr]">
          <div>
            <Logo light /><p className="mt-3 font-semibold text-white">{t("brand.slogan")}</p>
            <p className="mt-1 text-sm">{t("landing.contacts_text")}</p>
          </div>
          <div id="contacts">
            <p className="font-bold text-white">{t("landing.contacts_title")}</p>
            <p className="mt-2 flex items-center gap-2 text-sm"><Banknote className="h-4 w-4" aria-hidden />{t("landing.contacts_mail")}: <a className="underline" href="mailto:enactus.oshtu@example.org">enactus.oshtu@example.org</a></p>
            <p className="mt-1 text-xs text-eco-200">DEMO</p>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl px-4 text-xs text-eco-200">{t("footer.team")} · {t("footer.rights")}</p>
      </footer>
    </div>
  );
}
