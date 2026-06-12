"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, QrCode } from "lucide-react";
import {
  createEntryChargeAction,
  getPaymentStatusAction,
} from "@/app/actions/payments";
import {
  ENTRY_MIN_CENTS,
  ENTRY_MAX_TOTAL_CENTS,
  type StakingPhase,
} from "@/lib/staking";

const brl = (cents: number) => `R$${(cents / 100).toFixed(0)}`;

type Props = {
  stakeCents: number;
  phase: StakingPhase;
  open: boolean;
  topUpOnly: boolean;
  firstTimeOnly: boolean;
};

export function PayEntry({ stakeCents, phase, open, topUpOnly, firstTimeOnly }: Props) {
  const isFirst = stakeCents === 0;
  const minCents = isFirst ? ENTRY_MIN_CENTS : 100;
  const remainingCents = ENTRY_MAX_TOTAL_CENTS - stakeCents;
  const canStake =
    open &&
    remainingCents > 0 &&
    !(topUpOnly && isFirst) &&
    !(firstTimeOnly && !isFirst);

  const [reais, setReais] = useState(isFirst ? String(ENTRY_MIN_CENTS / 100) : "50");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charge, setCharge] = useState<{ paymentId: number; qrCode: string; qrCodeBase64: string } | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function generate() {
    setError(null);
    const cents = Math.round(Number(reais) * 100);
    if (!Number.isFinite(cents) || cents < minCents) {
      setError(`Mínimo ${brl(minCents)}.`);
      return;
    }
    if (cents > remainingCents) {
      setError(`Máximo ${brl(remainingCents)} (limite total ${brl(ENTRY_MAX_TOTAL_CENTS)}).`);
      return;
    }
    setPending(true);
    const result = await createEntryChargeAction(cents);
    setPending(false);
    if (!result.ok || !result.paymentId) {
      setError(result.error ?? "Erro ao gerar PIX.");
      return;
    }
    setCharge({
      paymentId: result.paymentId,
      qrCode: result.qrCode!,
      qrCodeBase64: result.qrCodeBase64!,
    });
    pollRef.current = setInterval(async () => {
      const status = await getPaymentStatusAction(result.paymentId!);
      if (status.ok && status.status === "paid") {
        if (pollRef.current) clearInterval(pollRef.current);
        setPaid(true);
      }
    }, 4000);
  }

  function copy() {
    if (!charge) return;
    navigator.clipboard.writeText(charge.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold tracking-wide">Sua aposta</h2>
        <span className="text-sm text-mute">
          Total: <span className="font-semibold text-neon">{brl(stakeCents)}</span>
        </span>
      </div>

      {paid ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-neon">
          <Check size={16} /> Pagamento confirmado! Aposta atualizada.
        </p>
      ) : charge ? (
        <div className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${charge.qrCodeBase64}`}
            alt="QR Code PIX"
            className="h-48 w-48 rounded-lg bg-white p-2"
          />
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:border-neon/60 hover:text-neon"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copiado!" : "Copiar Pix copia-e-cola"}
          </button>
          <p className="text-xs text-mute">Aguardando pagamento… confirma automaticamente.</p>
        </div>
      ) : canStake ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-mute">
            {isFirst
              ? `Aposte de ${brl(ENTRY_MIN_CENTS)} a ${brl(ENTRY_MAX_TOTAL_CENTS)}.`
              : `Aumente sua aposta (resta até ${brl(remainingCents)}).`}
            {topUpOnly && " Janela de aumento antes do mata-mata."}
            {firstTimeOnly &&
              isFirst &&
              " A fase de grupos já começou — os jogos já disputados contam 0 para você."}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-mute">R$</span>
            <input
              inputMode="numeric"
              value={reais}
              onChange={(event) => setReais(event.target.value.replace(/[^\d]/g, ""))}
              className="h-11 w-28 rounded-lg border border-line bg-base px-3 text-lg font-bold outline-none focus:border-neon"
            />
            <div className="flex gap-1.5">
              {[50, 100, 200].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReais(String(value))}
                  className="rounded-md border border-line px-2.5 py-1 text-sm text-mute hover:text-ink"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-neon text-sm font-semibold text-base transition hover:brightness-110 disabled:opacity-50"
          >
            <QrCode size={16} />
            {pending ? "Gerando…" : "Gerar PIX"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-mute">
          {phase === "group_running"
            ? "Aumentos reabrem após a fase de grupos — sua aposta já está valendo."
            : phase === "closed"
              ? "As apostas estão encerradas — o mata-mata começou."
              : topUpOnly && isFirst
                ? "A janela inicial de apostas já fechou."
                : remainingCents <= 0
                  ? `Você atingiu o limite de ${brl(ENTRY_MAX_TOTAL_CENTS)}.`
                  : "Apostas indisponíveis no momento."}
        </p>
      )}
    </div>
  );
}
