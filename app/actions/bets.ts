"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getMatchById, upsertBet, deleteBet } from "@/lib/db/queries";
import { canBet } from "@/lib/match";
import type { ActionResult } from "@/lib/types";

const scoreSchema = z.number().int().min(0).max(30);

export async function placeBetAction(
  matchId: number,
  homePred: number,
  awayPred: number,
): Promise<ActionResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Please sign in again." };

  const home = scoreSchema.safeParse(homePred);
  const away = scoreSchema.safeParse(awayPred);
  if (!home.success || !away.success) {
    return { ok: false, error: "Scores must be whole numbers between 0 and 30." };
  }

  const match = await getMatchById(matchId);
  if (!match) return { ok: false, error: "Match not found." };

  // Server-side enforcement of the betting window — the UI also mirrors this.
  if (!canBet(match)) {
    return { ok: false, error: "Betting is closed for this match." };
  }

  await upsertBet(user.id, matchId, home.data, away.data);
  revalidatePath("/matches");
  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  return { ok: true };
}

export async function clearBetAction(matchId: number): Promise<ActionResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Please sign in again." };

  const match = await getMatchById(matchId);
  if (!match) return { ok: false, error: "Match not found." };
  if (!canBet(match)) {
    return { ok: false, error: "Betting is closed for this match." };
  }

  await deleteBet(user.id, matchId);
  revalidatePath("/matches");
  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  return { ok: true };
}
