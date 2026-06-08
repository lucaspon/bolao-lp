"use server";

import { getSession } from "@/lib/auth/session";
import { createPixCharge } from "@/lib/asaas";
import {
  getStakingBounds,
  getUserStakeCents,
  createPaymentRow,
  attachCharge,
  markPaymentFailed,
  getPaymentById,
} from "@/lib/db/queries";
import {
  stakingWindow,
  ENTRY_MIN_CENTS,
  ENTRY_MAX_TOTAL_CENTS,
} from "@/lib/staking";

const real = (cents: number) => `R$${(cents / 100).toFixed(0)}`;

export type ChargeResult = {
  ok: boolean;
  error?: string;
  paymentId?: number;
  qrCode?: string;
  qrCodeBase64?: string;
};

export async function createEntryChargeAction(amountCents: number): Promise<ChargeResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Faça login novamente." };
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Valor inválido." };
  }

  const window = stakingWindow(await getStakingBounds());
  if (!window.open) {
    return {
      ok: false,
      error:
        window.phase === "group_running"
          ? "Apostas reabrem para aumento após a fase de grupos."
          : "As apostas estão encerradas.",
    };
  }

  const paid = await getUserStakeCents(user.id);
  if (window.topUpOnly && paid <= 0) {
    return { ok: false, error: "Janela de aumento — apenas para quem já apostou." };
  }
  if (paid === 0 && amountCents < ENTRY_MIN_CENTS) {
    return { ok: false, error: `Aposta mínima de ${real(ENTRY_MIN_CENTS)}.` };
  }
  if (paid + amountCents > ENTRY_MAX_TOTAL_CENTS) {
    return {
      ok: false,
      error: `Limite total ${real(ENTRY_MAX_TOTAL_CENTS)} (você já tem ${real(paid)}).`,
    };
  }

  const payment = await createPaymentRow(user.id, amountCents);
  try {
    const charge = await createPixCharge({
      amountCents,
      externalReference: String(payment.id),
    });
    await attachCharge(payment.id, charge);
    return {
      ok: true,
      paymentId: payment.id,
      qrCode: charge.qrCode,
      qrCodeBase64: charge.qrCodeBase64,
    };
  } catch {
    await markPaymentFailed(payment.id);
    return { ok: false, error: "Não foi possível gerar o PIX. Tente novamente." };
  }
}

export async function getPaymentStatusAction(
  paymentId: number,
): Promise<{ ok: boolean; status?: string; stakeCents?: number }> {
  const user = await getSession();
  if (!user) return { ok: false };
  const payment = await getPaymentById(paymentId);
  if (!payment || payment.userId !== user.id) return { ok: false };
  const stakeCents = await getUserStakeCents(user.id);
  return { ok: true, status: payment.status, stakeCents };
}
