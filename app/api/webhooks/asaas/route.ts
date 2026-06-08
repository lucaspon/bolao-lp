import { NextResponse, type NextRequest } from "next/server";
import { markPaymentPaid } from "@/lib/db/queries";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

type AsaasWebhook = {
  event: string;
  payment?: {
    id: string;
    externalReference: string | null;
    value: number;
    status: string;
  };
};

// Asaas posts here on payment events. We authenticate via the access-token header
// we configured on the webhook, then flip our matching payment row to paid.
export async function POST(request: NextRequest) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!token || request.headers.get("asaas-access-token") !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as AsaasWebhook;
  const payment = body.payment;

  if (
    (body.event === "PAYMENT_RECEIVED" || body.event === "PAYMENT_CONFIRMED") &&
    payment?.externalReference
  ) {
    const rowId = Number(payment.externalReference);
    if (Number.isInteger(rowId)) {
      await markPaymentPaid(rowId, Math.round(payment.value * 100), payment.id);
      revalidatePath("/profile");
      revalidatePath("/leaderboard");
      revalidatePath("/admin");
    }
  }

  return NextResponse.json({ ok: true });
}
