import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { users, matches, bets, type User, type Match } from "./schema";
import { isAdminEmail, usernameFromEmail } from "../auth/policy";
import { scoreBet } from "../scoring";

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

// How many matches are fully played — the denominator for points-percentage.
export async function getConcludedMatchCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(matches)
    .where(eq(matches.status, "finished"));
  return row.n;
}

export async function getLiveMatchCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(matches)
    .where(eq(matches.status, "live"));
  return row.n;
}

export type LeaderRow = {
  userId: number;
  username: string;
  points: number; // official: finished matches only
  exact: number;
  correct: number;
  picks: number;
  livePoints: number; // provisional: includes in-play matches
};

// Provisional points: scores in-play AND finished matches using their current score.
const livePointsExpr = sql<number>`coalesce(sum(
  case when ${matches.status} in ('live', 'finished')
            and ${matches.homeScore} is not null and ${matches.awayScore} is not null then
    case when ${bets.homePred} = ${matches.homeScore} and ${bets.awayPred} = ${matches.awayScore} then 3
         when sign(${bets.homePred} - ${bets.awayPred}) = sign(${matches.homeScore} - ${matches.awayScore}) then 1
         else 0 end
  else 0 end), 0)`;

// Standings: official points per user (+ a provisional total incl. in-play matches).
export async function getLeaderboard(): Promise<LeaderRow[]> {
  return db
    .select({
      userId: users.id,
      username: users.username,
      points: sql<number>`coalesce(sum(${bets.points}), 0)`.mapWith(Number),
      exact: sql<number>`count(*) filter (where ${bets.points} = 3)`.mapWith(Number),
      correct: sql<number>`count(*) filter (where ${bets.points} = 1)`.mapWith(Number),
      picks: sql<number>`count(${bets.id})`.mapWith(Number),
      livePoints: livePointsExpr.mapWith(Number),
    })
    .from(users)
    .leftJoin(bets, eq(bets.userId, users.id))
    .leftJoin(matches, eq(matches.id, bets.matchId))
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

export async function deleteBet(userId: number, matchId: number): Promise<void> {
  await db.delete(bets).where(and(eq(bets.userId, userId), eq(bets.matchId, matchId)));
}

// Recomputes points for every bet on a match. Used by the admin result entry
// and the live-results sync.
export async function rescoreMatch(
  matchId: number,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const matchBets = await tx.select().from(bets).where(eq(bets.matchId, matchId));
    for (const bet of matchBets) {
      const points = scoreBet(bet.homePred, bet.awayPred, homeScore, awayScore);
      await tx.update(bets).set({ points }).where(eq(bets.id, bet.id));
    }
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
