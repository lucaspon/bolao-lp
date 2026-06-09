// Thin Asaas client for PIX receipts. We mint one *static* Pix QR per payment
// (POST /pix/qrCodes/static) instead of a dynamic charge: static-QR receipts are
// free (Asaas's 100/month allowance), whereas dynamic charges cost the Pix +
// "mensageria" fees. When a static QR is paid, Asaas auto-creates a charge whose
// `pixQrCodeId` equals the QR's id — that's how the webhook reconciles it to the
// user (we store the id on the payment row when we create the QR).

const BASE_URL = process.env.ASAAS_BASE_URL ?? "https://api.asaas.com/v3";

function apiKey(): string {
  const key = process.env.API_KEY_ASAAS;
  if (!key) throw new Error("API_KEY_ASAAS is not set.");
  return key;
}

async function asaas<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: apiKey(), ...init?.headers },
    cache: "no-store",
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Asaas ${res.status} ${path}: ${text}`);
  }
  return body as T;
}

export type PixCharge = {
  pixQrCodeId: string; // the static QR's id — our reconciliation key
  qrCode: string; // copia-e-cola
  qrCodeBase64: string; // QR image (base64, no data: prefix)
};

export async function createPixCharge(args: {
  amountCents: number;
  reference: string; // our payment-row id, surfaced in the extrato description
  label?: string; // e.g. the username, for a human-readable description
}): Promise<PixCharge> {
  const addressKey = process.env.ASAAS_PIX_ADDRESS_KEY;
  if (!addressKey) throw new Error("ASAAS_PIX_ADDRESS_KEY is not set.");

  // Asaas caps the static-QR description at 37 chars (it's only for the extrato —
  // reconciliation is by pixQrCodeId, not this text).
  const description = `Bolão #${args.reference}${args.label ? ` ${args.label}` : ""}`.slice(0, 37);

  const qr = await asaas<{ id: string; payload: string; encodedImage: string }>(
    `/pix/qrCodes/static`,
    {
      method: "POST",
      body: JSON.stringify({
        addressKey,
        value: args.amountCents / 100,
        description,
        format: "ALL",
      }),
    },
  );

  return {
    pixQrCodeId: qr.id,
    qrCode: qr.payload,
    qrCodeBase64: qr.encodedImage,
  };
}

export async function getAsaasPayment(
  id: string,
): Promise<{ status: string; value: number; pixQrCodeId: string | null }> {
  return asaas(`/payments/${id}`);
}
