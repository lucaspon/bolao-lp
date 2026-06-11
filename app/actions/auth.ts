"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedEmail, normalizeEmail } from "@/lib/auth/policy";
import { issueCode, verifyCode } from "@/lib/auth/otp";
import { createSession, destroySession } from "@/lib/auth/session";
import { sendLoginCode } from "@/lib/email";
import { upsertUser } from "@/lib/db/queries";
import type { ActionResult } from "@/lib/types";

const emailSchema = z.email();
const codeSchema = z.string().regex(/^\d{6}$/, "Digite o código de 6 dígitos.");

export async function requestCodeAction(email: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(normalizeEmail(email));
  if (!parsed.success) return { ok: false, error: "Digite um e-mail válido." };

  const value = parsed.data;
  if (!isAllowedEmail(value)) {
    return { ok: false, error: "Use um e-mail de um domínio autorizado." };
  }

  try {
    const code = await issueCode(value);
    await sendLoginCode(value, code);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Não foi possível enviar o código." };
  }
}

export async function verifyCodeAction(email: string, code: string): Promise<ActionResult> {
  const value = normalizeEmail(email);
  if (!isAllowedEmail(value)) return { ok: false, error: "Não permitido." };

  const parsedCode = codeSchema.safeParse(code.trim());
  if (!parsedCode.success) return { ok: false, error: parsedCode.error.issues[0].message };

  const valid = await verifyCode(value, parsedCode.data);
  if (!valid) return { ok: false, error: "Código inválido ou expirado." };

  const user = await upsertUser(value);
  await createSession({
    id: user.id,
    email: user.email,
    username: user.username,
    isAdmin: user.isAdmin,
  });
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
