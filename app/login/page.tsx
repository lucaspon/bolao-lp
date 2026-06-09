"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Trophy, ArrowRight, Mail } from "lucide-react";
import { requestCodeAction, verifyCodeAction } from "@/app/actions/auth";

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function sendCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestCodeAction(email);
      if (!result.ok) {
        setError(result.error ?? "Algo deu errado.");
        return;
      }
      setStep("code");
    });
  }

  function verify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyCodeAction(email, code);
      if (!result.ok) {
        setError(result.error ?? "Código inválido.");
        return;
      }
      window.location.assign("/matches");
    });
  }

  return (
    <div className="pitch-stripes flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-7 flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-panel neon-glow">
          <Trophy className="text-neon" size={26} />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-wide">
          BOLÃO <span className="text-neon">DA COPA 2026</span>
        </h1>
        <p className="mt-1 text-sm text-mute">Bolão Lumina × OKT</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6">
        {step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <label className="text-sm font-medium text-ink" htmlFor="email">
              E-mail corporativo
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-base px-3">
              <Mail size={16} className="text-mute" />
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@luminacm.com"
                className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-mute"
              />
            </div>
            <p className="text-xs text-mute">
              Enviaremos um código de 6 dígitos por e-mail. Apenas endereços
              @luminacm.com e @oktcapital.com podem entrar.
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="mt-1 flex h-11 items-center justify-center gap-2 rounded-lg bg-neon text-sm font-semibold text-base transition hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "Enviando…" : "Enviar código"}
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-3">
            <label className="text-sm font-medium text-ink" htmlFor="code">
              Digite o código enviado para <span className="text-neon">{email}</span>
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              className="tabular h-12 w-full rounded-lg border border-line bg-base text-center text-2xl font-bold tracking-[0.5em] indent-[0.5em] outline-none placeholder:text-mute focus:border-neon"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={pending || code.length !== 6}
              className="mt-1 flex h-11 items-center justify-center gap-2 rounded-lg bg-neon text-sm font-semibold text-base transition hover:brightness-110 disabled:opacity-50"
            >
              {pending ? "Verificando…" : "Verificar e entrar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="text-xs text-mute hover:text-ink"
            >
              ← Usar outro e-mail
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
