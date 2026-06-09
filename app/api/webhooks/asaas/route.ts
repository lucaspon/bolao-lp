import { NextResponse, type NextRequest } from "next/server";
import { markPaymentPaid, markPaymentPaidByQrCode } from "@/lib/db/queries";
import { getAsaasPayment } from "@/lib/asaas";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type AsaasWebhook = {
  event: string;
  payment?: {
    id: string;
    externalReference: string | null;
    pixQrCodeId: string | null;
    value: number;
    status: string;
  };
};

// Asaas posts here on payment events. We authenticate via the access-token header
// we configured on the webhook, then flip our matching payment row to paid.
//
// Static-QR payments arrive as auto-created charges with `pixQrCodeId` set (= the
// id of the QR we minted, stored on the row). We reconcile on that. The
// `externalReference` path is kept for any legacy dynamic charges.
export async function POST(request: NextRequest) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!token || request.headers.get("asaas-access-token") !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as AsaasWebhook;
  const payment = body.payment;
  const isPaid = body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED";

  if (isPaid && payment) {
    const amountCents = Math.round(payment.value * 100);
    const rowId = payment.externalReference ? Number(payment.externalReference) : NaN;

    if (Number.isInteger(rowId)) {
      await markPaymentPaid(rowId, amountCents, payment.id);
    } else {
      // Some webhook payloads omit pixQrCodeId — fetch the charge to be sure.
      const qrId =
        payment.pixQrCodeId ?? (await getAsaasPayment(payment.id).catch(() => null))?.pixQrCodeId;
      if (qrId) await markPaymentPaidByQrCode(qrId, amountCents);
    }

    revalidatePath("/profile");
    revalidatePath("/leaderboard");
    revalidatePath("/admin");
  }

  return NextResponse.json({ ok: true });
}
