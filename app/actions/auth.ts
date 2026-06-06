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
const codeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code.");

export async function requestCodeAction(email: string): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(normalizeEmail(email));
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };

  const value = parsed.data;
  if (!isAllowedEmail(value)) {
    return { ok: false, error: "Use your @luminacm.com or @oktcapital.com email." };
  }

  try {
    const code = await issueCode(value);
    await sendLoginCode(value, code);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not send code." };
  }
}

export async function verifyCodeAction(email: string, code: string): Promise<ActionResult> {
  const value = normalizeEmail(email);
  if (!isAllowedEmail(value)) return { ok: false, error: "Not allowed." };

  const parsedCode = codeSchema.safeParse(code.trim());
  if (!parsedCode.success) return { ok: false, error: parsedCode.error.issues[0].message };

  const valid = await verifyCode(value, parsedCode.data);
  if (!valid) return { ok: false, error: "Invalid or expired code." };

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
