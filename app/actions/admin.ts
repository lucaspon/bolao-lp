"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { matches, bets } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { scoreBet } from "@/lib/scoring";
import { TEAMS } from "@/lib/teams";
import type { ActionResult } from "@/lib/types";

async function assertAdmin(): Promise<ActionResult | null> {
  const user = await getSession();
  if (!user?.isAdmin) return { ok: false, error: "Admins only." };
  return null;
}

function revalidateAll() {
  revalidatePath("/matches");
  revalidatePath("/leaderboard");
  revalidatePath("/profile");
  revalidatePath("/admin");
}

const teamCode = z.string().refine((code) => code === "" || code in TEAMS, "Unknown team");

// Set / change the two teams and the kickoff time of a fixture.
export async function setMatchInfoAction(
  matchId: number,
  homeTeam: string,
  awayTeam: string,
  kickoffIso: string,
): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return denied;

  if (!teamCode.safeParse(homeTeam).success || !teamCode.safeParse(awayTeam).success) {
    return { ok: false, error: "Unknown team code." };
  }
  const kickoff = new Date(kickoffIso);
  if (Number.isNaN(kickoff.getTime())) return { ok: false, error: "Invalid kickoff time." };

  await db
    .update(matches)
    .set({
      homeTeam: homeTeam || null,
      awayTeam: awayTeam || null,
      kickoffAt: kickoff,
    })
    .where(eq(matches.id, matchId));

  revalidateAll();
  return { ok: true };
}

const score = z.coerce.number().int().min(0).max(30);

// Record (or clear) a final score. Recomputes points for every bet on the match.
export async function setResultAction(
  matchId: number,
  homeScoreRaw: string,
  awayScoreRaw: string,
): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const clearing = homeScoreRaw === "" && awayScoreRaw === "";

  if (clearing) {
    await db.transaction(async (tx) => {
      await tx
        .update(matches)
        .set({ homeScore: null, awayScore: null })
        .where(eq(matches.id, matchId));
      await tx.update(bets).set({ points: null }).where(eq(bets.matchId, matchId));
    });
    revalidateAll();
    return { ok: true };
  }

  if (homeScoreRaw === "" || awayScoreRaw === "") {
    return { ok: false, error: "Enter both scores (0–30), or leave both blank to clear." };
  }
  const homeParsed = score.safeParse(homeScoreRaw);
  const awayParsed = score.safeParse(awayScoreRaw);
  if (!homeParsed.success || !awayParsed.success) {
    return { ok: false, error: "Enter both scores (0–30), or leave both blank to clear." };
  }
  const home = homeParsed.data;
  const away = awayParsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({ homeScore: home, awayScore: away })
      .where(eq(matches.id, matchId));

    const matchBets = await tx.select().from(bets).where(eq(bets.matchId, matchId));
    for (const bet of matchBets) {
      const points = scoreBet(bet.homePred, bet.awayPred, home, away);
      await tx.update(bets).set({ points }).where(eq(bets.id, bet.id));
    }
  });

  revalidateAll();
  return { ok: true };
}
