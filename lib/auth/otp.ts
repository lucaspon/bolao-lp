import { createHash, randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { loginCodes } from "../db/schema";

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30_000;

function hashCode(email: string, code: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${email}:${code}:${secret}`).digest("hex");
}

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Creates a fresh code for the email, replacing any previous one. Throws if a
// code was requested very recently (basic anti-spam).
export async function issueCode(email: string): Promise<string> {
  const existing = await db
    .select()
    .from(loginCodes)
    .where(eq(loginCodes.email, email))
    .limit(1);

  if (existing[0] && Date.now() - existing[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new Error("Please wait a moment before requesting another code.");
  }

  const code = generateCode();
  await db.delete(loginCodes).where(eq(loginCodes.email, email));
  await db.insert(loginCodes).values({
    email,
    codeHash: hashCode(email, code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
  });
  return code;
}

export async function verifyCode(email: string, code: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(loginCodes)
    .where(eq(loginCodes.email, email))
    .limit(1);
  const row = rows[0];
  if (!row) return false;

  const expired = row.expiresAt.getTime() < Date.now();
  if (expired || row.attempts >= MAX_ATTEMPTS) {
    await db.delete(loginCodes).where(eq(loginCodes.email, email));
    return false;
  }

  if (row.codeHash !== hashCode(email, code)) {
    await db
      .update(loginCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(loginCodes.id, row.id));
    return false;
  }

  await db.delete(loginCodes).where(eq(loginCodes.email, email));
  return true;
}
