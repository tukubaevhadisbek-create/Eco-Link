"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { loginAction, registerAction, requestResetAction, resetPasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select } from "@/components/ui/primitives";
import { LOCALITIES, loginSchema, registerSchema } from "@/lib/validation";
import { useErr } from "./use-err";

export function LoginForm() {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, formState: { errors } } = useForm<{ phone: string; password: string }>({
    resolver: zodResolver(loginSchema) as never,
    defaultValues: { phone: "+996" },
  });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setBusy(true); setFormError(undefined);
        const r = await loginAction(v);
        if (r.ok) { router.push(r.redirectTo); router.refresh(); return; }
        setFormError(err(r.error)); setBusy(false);
      })}
    >
      <div>
        <Label htmlFor="phone">{t("auth.phone")}</Label>
        <Input id="phone" type="tel" inputMode="tel" autoComplete="username" {...register("phone")} />
        <FieldError>{err(errors.phone?.message)}</FieldError>
      </div>
      <div>
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
        <FieldError>{err(errors.password?.message)}</FieldError>
      </div>
      <FieldError>{formError}</FieldError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? t("common.loading") : t("auth.login")}</Button>
      <p className="text-center text-sm"><Link href="/forgot" className="font-semibold text-eco-600 hover:underline">{t("auth.forgot")}</Link></p>
    </form>
  );
}

type RegValues = { name: string; phone: string; password: string; locality: string; role: "RESIDENT" | "BUYER"; consent: boolean };

export function RegisterForm({ defaultRole }: { defaultRole: "RESIDENT" | "BUYER" }) {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string>();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegValues>({
    resolver: zodResolver(registerSchema) as never,
    defaultValues: { phone: "+996", role: defaultRole, locality: "Кара-Суу", consent: false },
  });
  const role = watch("role");
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setBusy(true); setFormError(undefined);
        const r = await registerAction(v);
        if (r.ok) { toast.success(t("auth.registered")); router.push(r.redirectTo); router.refresh(); return; }
        setFormError(err(r.error)); setBusy(false);
      })}
    >
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{t("auth.role")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["RESIDENT", "BUYER"] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => setValue("role", r)}
              className={`rounded-xl border px-3 py-3 text-left text-sm transition ${role === r ? "border-eco-500 bg-eco-50 ring-4 ring-eco-500/10" : "border-line bg-white hover:bg-eco-50"}`}
            >
              <span className="block font-bold">{t(`auth.role_${r}`)}</span>
              <span className="block text-xs text-ink-soft">{t(`auth.role_${r}_hint`)}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <Label htmlFor="name">{t("auth.name")}</Label>
        <Input id="name" autoComplete="name" {...register("name")} />
        <FieldError>{err(errors.name?.message)}</FieldError>
      </div>
      <div>
        <Label htmlFor="phone">{t("auth.phone")}</Label>
        <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+996 700 123 456" {...register("phone")} />
        <FieldError>{err(errors.phone?.message)}</FieldError>
      </div>
      <div>
        <Label htmlFor="password">{t("auth.password")}</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        <p className="mt-1 text-xs text-ink-soft">{t("auth.password_hint")}</p>
        <FieldError>{err(errors.password?.message)}</FieldError>
      </div>
      <div>
        <Label htmlFor="locality">{t("auth.locality")}</Label>
        <Select id="locality" {...register("locality")}>
          {LOCALITIES.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
        <FieldError>{err(errors.locality?.message)}</FieldError>
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 rounded border-line accent-[#168B53]" {...register("consent")} />
          <span>{t("auth.consent")}</span>
        </label>
        <FieldError>{err(errors.consent?.message)}</FieldError>
      </div>
      <FieldError>{formError}</FieldError>
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? t("common.loading") : t("auth.register")}</Button>
    </form>
  );
}

export function ForgotForm() {
  const t = useTranslations();
  const err = useErr();
  const router = useRouter();
  const [phone, setPhone] = useState("+996");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("auth.reset_demo_note")}</div>
      {stage === "phone" ? (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault(); setBusy(true); setError(undefined);
            const r = await requestResetAction(phone);
            setBusy(false);
            if (!r.ok) return setError(err(r.error));
            setDemoCode(r.demoCode); setStage("code");
          }}
        >
          <div><Label htmlFor="phone">{t("auth.phone")}</Label><Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <FieldError>{error}</FieldError>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{t("auth.reset_get_code")}</Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault(); setBusy(true); setError(undefined);
            const r = await resetPasswordAction({ phone, code, password });
            setBusy(false);
            if (!r.ok) return setError(err(r.error));
            toast.success(t("auth.reset_done")); router.push("/login");
          }}
        >
          {demoCode && (
            <div className="rounded-xl border border-eco-200 bg-eco-50 p-3 text-sm">
              {t("auth.reset_demo_code")}: <b data-testid="demo-reset-code" className="font-mono text-lg tracking-widest">{demoCode}</b>
            </div>
          )}
          <div><Label htmlFor="code">{t("auth.reset_code")}</Label><Input id="code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div><Label htmlFor="np">{t("auth.new_password")}</Label><Input id="np" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <FieldError>{error}</FieldError>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{t("auth.reset_submit")}</Button>
        </form>
      )}
    </div>
  );
}
