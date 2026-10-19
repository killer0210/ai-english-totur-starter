"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postJson } from "@/lib/api-client";
import { otpRequestSchema, otpVerifySchema } from "@/lib/auth/schemas";

// Matches Supabase `auth.email.max_frequency` (supabase/config.toml).
const RESEND_COOLDOWN_SECONDS = 60;

type Step = "email" | "code";
type Status = "idle" | "submitting" | "redirecting";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("login");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const ids = { email: useId(), code: useId(), error: useId(), status: useId() };

  const [step, setStep] = useState<Step>("email");
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const busy = status !== "idle";

  async function requestCode(isResend: boolean) {
    const parsed = otpRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setError(t("emailInvalid"));
      return;
    }
    setError(null);
    setStatus("submitting");
    const result = await postJson<{ sent: boolean }>("/api/auth/otp", parsed.data);
    setStatus("idle");
    if (!result.ok) {
      setError(result.error?.message_mn ?? tCommon("networkError"));
      return;
    }
    setEmail(parsed.data.email);
    setStep("code");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setNotice(isResend ? t("resent") : t("codeSent", { email: parsed.data.email }));
  }

  async function verifyCode() {
    const parsed = otpVerifySchema.safeParse({ email, code, next });
    if (!parsed.success) {
      setError(t("codeInvalid"));
      return;
    }
    setError(null);
    setStatus("submitting");
    const result = await postJson<{ redirectTo: string }>("/api/auth/verify", parsed.data);
    if (!result.ok) {
      setStatus("idle");
      setError(result.error?.message_mn ?? tCommon("networkError"));
      return;
    }
    setStatus("redirecting");
    setNotice(t("redirecting"));
    router.replace(result.data.redirectTo);
    router.refresh();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    void (step === "email" ? requestCode(false) : verifyCode());
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setNotice(null);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p id={ids.status} role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {notice}
      </p>

      {step === "email" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.email}>{t("emailLabel")}</Label>
          <Input
            id={ids.email}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? ids.error : undefined}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.code}>{t("codeLabel")}</Label>
          <Input
            id={ids.code}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? ids.error : undefined}
            className="tracking-[0.3em]"
          />
        </div>
      )}

      {error ? (
        <p id={ids.error} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={busy} className="w-full">
        {step === "email"
          ? status === "submitting"
            ? t("sending")
            : t("sendCode")
          : status === "idle"
            ? t("verify")
            : t("verifying")}
      </Button>

      {step === "code" ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy || cooldown > 0}
            onClick={() => void requestCode(true)}
          >
            {t("resend")}
          </Button>
          {cooldown > 0 ? (
            <p className="text-sm text-muted-foreground">{t("resendIn", { seconds: cooldown })}</p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={changeEmail}
          >
            {t("changeEmail")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
