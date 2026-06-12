import { and, asc, desc, eq, ne, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { users, matches, bets, payments, type User, type Match, type Payment } from "./schema";
import { isAdminEmail, usernameFromEmail } from "../auth/policy";
import { scoreBet } from "../scoring";
import type { StakingBounds } from "../staking";

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

export async function getMatchCountsByStage(): Promise<Record<string, number>> {
  const rows = await db
    .select({ stage: matches.stage, n: sql<number>`count(*)`.mapWith(Number) })
    .from(matches)
    .groupBy(matches.stage);
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.stage] = row.n;
  return counts;
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
  points: number; // official total (finished matches)
  exact: number;
  correct: number;
  picks: number;
  livePoints: number; // provisional total (incl. in-play)
  groupPoints: number;
  koPoints: number;
  groupLivePoints: number;
  koLivePoints: number;
  stakeCents: number; // total paid buy-in
  stakeW1Cents: number; // group-phase stake: paid before the group stage ended
};

// Provisional points (in-play + finished), optionally scoped to a stage filter.
function liveExpr(stageFilter: SQL) {
  return sql<number>`coalesce(sum(
    case when ${matches.status} in ('live', 'finished')
              and ${matches.homeScore} is not null and ${matches.awayScore} is not null ${stageFilter} then
      (case when ${bets.homePred} = ${matches.homeScore} and ${bets.awayPred} = ${matches.awayScore} then 3
            when sign(${bets.homePred} - ${bets.awayPred}) = sign(${matches.homeScore} - ${matches.awayScore}) then 1
            else 0 end) * ${matches.pointsMultiplier}
    else 0 end), 0)`;
}

const isGroup = sql`and ${matches.stage} = 'group'`;
const isKnockout = sql`and ${matches.stage} <> 'group'`;

// Standings + the per-phase splits used by the phase-locked payout.
export async function getLeaderboard(): Promise<LeaderRow[]> {
  const bounds = await getStakingBounds();
  // The group-phase stake is everything committed before the group stage ENDS.
  // That lets a mid-group joiner's stake ride on the (future) group matches they
  // bet on, while a post-group top-up still rides on knockout points only. Bind
  // as an ISO string (postgres.js won't bind a raw Date) and cast in SQL.
  const groupStakeCutoffIso = (
    Number.isFinite(bounds.lastGroupMs)
      ? new Date(bounds.lastGroupMs)
      : new Date(8640000000000000) // far future → everything counts as group-phase
  ).toISOString();

  return db
    .select({
      userId: users.id,
      username: users.username,
      points: sql<number>`coalesce(sum(${bets.points}), 0)`.mapWith(Number),
      exact: sql<number>`count(*) filter (where ${bets.points} = 3 * ${matches.pointsMultiplier})`.mapWith(Number),
      correct: sql<number>`count(*) filter (where ${bets.points} = 1 * ${matches.pointsMultiplier})`.mapWith(Number),
      picks: sql<number>`count(${bets.id})`.mapWith(Number),
      livePoints: liveExpr(sql``).mapWith(Number),
      groupPoints: sql<number>`coalesce(sum(${bets.points}) filter (where ${matches.stage} = 'group'), 0)`.mapWith(Number),
      koPoints: sql<number>`coalesce(sum(${bets.points}) filter (where ${matches.stage} <> 'group'), 0)`.mapWith(Number),
      groupLivePoints: liveExpr(isGroup).mapWith(Number),
      koLivePoints: liveExpr(isKnockout).mapWith(Number),
      stakeCents: sql<number>`coalesce((select sum(${payments.amountCents}) from ${payments} where ${payments.userId} = ${users.id} and ${payments.status} = 'paid'), 0)`.mapWith(
        Number,
      ),
      stakeW1Cents: sql<number>`coalesce((select sum(${payments.amountCents}) from ${payments} where ${payments.userId} = ${users.id} and ${payments.status} = 'paid' and ${payments.createdAt} < ${groupStakeCutoffIso}::timestamptz), 0)`.mapWith(
        Number,
      ),
    })
    .from(users)
    .leftJoin(bets, eq(bets.userId, users.id))
    .leftJoin(matches, eq(matches.id, bets.matchId))
    .groupBy(users.id, users.username)
    .orderBy(
      sql`coalesce(sum(${bets.points}), 0) desc`,
      sql`count(*) filter (where ${bets.points} = 3 * ${matches.pointsMultiplier}) desc`,
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

// Marks a match in-play with its current score (the live overlay from
// API-Football). Never touches a finished match.
export async function applyLiveScore(
  matchId: number,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  await db
    .update(matches)
    .set({ status: "live", homeScore, awayScore })
    .where(and(eq(matches.id, matchId), ne(matches.status, "finished")));
}

// True if any bet on a match still lacks points — used by the sync to decide
// whether a finished match needs (re)scoring.
export async function hasUnscoredBets(matchId: number): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(bets)
    .where(and(eq(bets.matchId, matchId), isNull(bets.points)));
  return row.n > 0;
}

// Recomputes points for every bet on a match. Used by the admin result entry
// and the live-results sync.
export async function rescoreMatch(
  matchId: number,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [match] = await tx
      .select({ multiplier: matches.pointsMultiplier })
      .from(matches)
      .where(eq(matches.id, matchId));
    const multiplier = match?.multiplier ?? 1;
    const matchBets = await tx.select().from(bets).where(eq(bets.matchId, matchId));
    for (const bet of matchBets) {
      const points = scoreBet(bet.homePred, bet.awayPred, homeScore, awayScore) * multiplier;
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

// ---- Payments / stakes ------------------------------------------------------

export async function getStakingBounds(): Promise<StakingBounds> {
  const [row] = await db
    .select({
      firstGroup: sql<string | null>`min(${matches.kickoffAt}) filter (where ${matches.stage} = 'group')`,
      lastGroup: sql<string | null>`max(${matches.kickoffAt}) filter (where ${matches.stage} = 'group')`,
      firstKnockout: sql<string | null>`min(${matches.kickoffAt}) filter (where ${matches.stage} = 'round_of_32')`,
    })
    .from(matches);
  const ms = (value: string | null, fallback: number) =>
    value ? new Date(value).getTime() : fallback;
  return {
    firstGroupMs: ms(row.firstGroup, Number.POSITIVE_INFINITY),
    lastGroupMs: ms(row.lastGroup, Number.POSITIVE_INFINITY),
    firstKnockoutMs: ms(row.firstKnockout, Number.POSITIVE_INFINITY),
  };
}

export async function createPaymentRow(userId: number, amountCents: number): Promise<Payment> {
  const [row] = await db.insert(payments).values({ userId, amountCents }).returning();
  return row;
}

export async function attachCharge(
  paymentId: number,
  charge: { providerPaymentId: string; qrCode: string; qrCodeBase64: string },
): Promise<void> {
  await db
    .update(payments)
    .set({
      providerPaymentId: charge.providerPaymentId,
      qrCode: charge.qrCode,
      qrCodeBase64: charge.qrCodeBase64,
    })
    .where(eq(payments.id, paymentId));
}

export async function markPaymentFailed(paymentId: number): Promise<void> {
  await db.update(payments).set({ status: "failed" }).where(eq(payments.id, paymentId));
}

// Idempotent: flips a pending row to paid (keyed by our row id = externalReference).
export async function markPaymentPaid(
  paymentRowId: number,
  amountCents: number,
  providerPaymentId: string,
): Promise<void> {
  await db
    .update(payments)
    .set({ status: "paid", paidAt: new Date(), amountCents, providerPaymentId })
    .where(eq(payments.id, paymentRowId));
}

// Idempotent: flips the row whose static QR was paid (we store the QR id in
// providerPaymentId when the charge is created). Used by the static-Pix webhook.
export async function markPaymentPaidByQrCode(
  pixQrCodeId: string,
  amountCents: number,
): Promise<void> {
  await db
    .update(payments)
    .set({ status: "paid", paidAt: new Date(), amountCents })
    .where(and(eq(payments.providerPaymentId, pixQrCodeId), ne(payments.status, "paid")));
}

export async function getPaymentById(id: number): Promise<Payment | null> {
  const rows = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserStakeCents(userId: number): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number) })
    .from(payments)
    .where(and(eq(payments.userId, userId), eq(payments.status, "paid")));
  return row.total;
}

export async function getPotTotalCents(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number) })
    .from(payments)
    .where(eq(payments.status, "paid"));
  return row.total;
}

export type AdminPaymentRow = {
  userId: number;
  username: string;
  stakeCents: number;
  lastPaidAt: Date | null;
};

export async function getPaymentsForAdmin(): Promise<AdminPaymentRow[]> {
  return db
    .select({
      userId: users.id,
      username: users.username,
      stakeCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'paid'), 0)`.mapWith(
        Number,
      ),
      lastPaidAt: sql<Date | null>`max(${payments.paidAt})`,
    })
    .from(users)
    .leftJoin(payments, eq(payments.userId, users.id))
    .groupBy(users.id, users.username)
    .orderBy(desc(sql`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'paid'), 0)`), asc(users.username));
}
