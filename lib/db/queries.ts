import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { users, matches, bets, type User, type Match } from "./schema";
import { isAdminEmail, usernameFromEmail } from "../auth/policy";

export type MatchWithBet = Match & {
  bet: { homePred: number; awayPred: number; points: number | null } | null;
};

// All fixtures, each with the current user's prediction attached (if any).
export async function getMatchesForUser(userId: number): Promise<MatchWithBet[]> {
  const rows = await db
    .select()
    .from(matches)
    .leftJoin(bets, and(eq(bets.matchId, matches.id), eq(bets.userId, userId)))
    .orderBy(asc(matches.kickoffAt));

  return rows.map((row) => ({
    ...row.matches,
    bet: row.bets
      ? { homePred: row.bets.homePred, awayPred: row.bets.awayPred, points: row.bets.points }
      : null,
  }));
}

export type AdminMatchRow = { match: Match; betCount: number };

// All fixtures with how many bets each has — used by the admin page.
export async function getAdminMatches(): Promise<AdminMatchRow[]> {
  const rows = await db
    .select({
      match: matches,
      betCount: sql<number>`count(${bets.id})`.mapWith(Number),
    })
    .from(matches)
    .leftJoin(bets, eq(bets.matchId, matches.id))
    .groupBy(matches.id)
    .orderBy(asc(matches.kickoffAt));
  return rows;
}

export async function getMatchById(id: number): Promise<Match | null> {
  const rows = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  return rows[0] ?? null;
}

export type LeaderRow = {
  userId: number;
  username: string;
  points: number;
  exact: number;
  correct: number;
  picks: number;
};

// Standings: total points per user, with exact/correct counts as tie-breakers.
export async function getLeaderboard(): Promise<LeaderRow[]> {
  return db
    .select({
      userId: users.id,
      username: users.username,
      points: sql<number>`coalesce(sum(${bets.points}), 0)`.mapWith(Number),
      exact: sql<number>`count(*) filter (where ${bets.points} = 3)`.mapWith(Number),
      correct: sql<number>`count(*) filter (where ${bets.points} = 1)`.mapWith(Number),
      picks: sql<number>`count(${bets.id})`.mapWith(Number),
    })
    .from(users)
    .leftJoin(bets, eq(bets.userId, users.id))
    .groupBy(users.id, users.username)
    .orderBy(
      sql`coalesce(sum(${bets.points}), 0) desc`,
      sql`count(*) filter (where ${bets.points} = 3) desc`,
      asc(users.username),
    );
}

export async function upsertBet(
  userId: number,
  matchId: number,
  homePred: number,
  awayPred: number,
): Promise<void> {
  await db
    .insert(bets)
    .values({ userId, matchId, homePred, awayPred, points: null })
    .onConflictDoUpdate({
      target: [bets.userId, bets.matchId],
      set: { homePred, awayPred, points: null, updatedAt: new Date() },
    });
}

// Creates the user on first login; refreshes admin status from env on each login.
export async function upsertUser(email: string): Promise<User> {
  const [row] = await db
    .insert(users)
    .values({
      email,
      username: usernameFromEmail(email),
      isAdmin: isAdminEmail(email),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { isAdmin: isAdminEmail(email) },
    })
    .returning();
  return row;
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}
