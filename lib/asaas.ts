// Thin Asaas client for PIX charges. All charges hang off one internal "pool"
// customer (identified by externalReference) — colleagues just pay the QR, so we
// never need their CPF. Each charge carries our payment-row id as
// `externalReference`, which the webhook hands back to reconcile.

const BASE_URL = process.env.ASAAS_BASE_URL ?? "https://api.asaas.com/v3";
const POOL_CUSTOMER_REF = "bolao-pool";

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

let poolCustomerId: string | null = null;

async function getPoolCustomerId(): Promise<string> {
  if (poolCustomerId) return poolCustomerId;
  const cpf = process.env.POOL_CPF;

  const found = await asaas<{ data?: { id: string; cpfCnpj: string | null }[] }>(
    `/customers?externalReference=${POOL_CUSTOMER_REF}&limit=1`,
  );
  if (found.data && found.data.length > 0) {
    const existing = found.data[0];
    poolCustomerId = existing.id;
    // Asaas needs the customer to carry a CPF/CNPJ to bill it — backfill if missing.
    if (cpf && !existing.cpfCnpj) {
      await asaas(`/customers/${existing.id}`, {
        method: "POST",
        body: JSON.stringify({ cpfCnpj: cpf }),
      });
    }
    return poolCustomerId;
  }

  const created = await asaas<{ id: string }>(`/customers`, {
    method: "POST",
    body: JSON.stringify({
      name: "Bolão LCM (pool)",
      externalReference: POOL_CUSTOMER_REF,
      ...(cpf ? { cpfCnpj: cpf } : {}),
    }),
  });
  poolCustomerId = created.id;
  return poolCustomerId;
}

export type PixCharge = {
  providerPaymentId: string;
  qrCode: string; // copia-e-cola
  qrCodeBase64: string; // QR image (base64, no data: prefix)
};

export async function createPixCharge(args: {
  amountCents: number;
  externalReference: string;
}): Promise<PixCharge> {
  const customer = await getPoolCustomerId();
  const dueDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

  const charge = await asaas<{ id: string }>(`/payments`, {
    method: "POST",
    body: JSON.stringify({
      customer,
      billingType: "PIX",
      value: args.amountCents / 100,
      dueDate,
      externalReference: args.externalReference,
      description: "Bolão da Copa 2026 — entrada",
    }),
  });

  const qr = await asaas<{ payload: string; encodedImage: string }>(
    `/payments/${charge.id}/pixQrCode`,
  );

  return {
    providerPaymentId: charge.id,
    qrCode: qr.payload,
    qrCodeBase64: qr.encodedImage,
  };
}

export async function getAsaasPayment(id: string): Promise<{ status: string; value: number }> {
  return asaas(`/payments/${id}`);
}
