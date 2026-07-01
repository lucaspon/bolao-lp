import { and, asc, desc, eq, ne, isNull, isNotNull, inArray, sql, type SQL } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "./client";
import {
  users,
  matches,
  bets,
  payments,
  type User,
  type Match,
  type Payment,
  type Stage,
} from "./schema";
import { isAdminEmail, usernameFromEmail } from "../auth/policy";
import { scoreBet } from "../scoring";
import { BRAZIL_CODE } from "../match";
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
    // Canonical, stable order: kickoff, then teams alphabetically, then id as a
    // final tiebreaker — so simultaneous matches don't reshuffle between refreshes.
    .orderBy(asc(matches.kickoffAt), asc(matches.homeTeam), asc(matches.awayTeam), asc(matches.id));

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

// ---- Recent results feed ----------------------------------------------------

export type ResultBettor = { userId: number; username: string };

export type ResultFeedItem = {
  matchId: number;
  stage: Stage;
  groupLabel: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  kickoffMs: number;
  multiplier: number;
  exact: ResultBettor[]; // cravaram o placar
  correct: ResultBettor[]; // acertaram só o resultado
  totalPicks: number;
  live: boolean; // true = in progress; the buckets are a preview of the current score
};

// The most recent matches — live ones first (a preview of who'd score if the
// current score held), then the latest finished — each with who nailed the exact
// score and who just got the result right. Powers the leaderboard's results feed.
export async function getRecentResults(limit = 10): Promise<ResultFeedItem[]> {
  const recent = await db
    .select()
    .from(matches)
    .where(
      and(
        inArray(matches.status, ["live", "finished"]),
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore),
      ),
    )
    // Live (in-progress) matches first, then most recent kickoffs.
    .orderBy(sql`case when ${matches.status} = 'live' then 0 else 1 end`, desc(matches.kickoffAt))
    .limit(limit);
  if (recent.length === 0) return [];

  const ids = recent.map((m) => m.id);
  const picks = await db
    .select({
      matchId: bets.matchId,
      userId: users.id,
      username: users.username,
      homePred: bets.homePred,
      awayPred: bets.awayPred,
    })
    .from(bets)
    .innerJoin(users, eq(users.id, bets.userId))
    .where(inArray(bets.matchId, ids));

  const byMatch = new Map<number, typeof picks>();
  for (const pick of picks) {
    const list = byMatch.get(pick.matchId);
    if (list) list.push(pick);
    else byMatch.set(pick.matchId, [pick]);
  }

  return recent.map((match) => {
    const list = byMatch.get(match.id) ?? [];
    const exact: ResultBettor[] = [];
    const correct: ResultBettor[] = [];
    for (const pick of list) {
      const base = scoreBet(pick.homePred, pick.awayPred, match.homeScore!, match.awayScore!);
      if (base === 3) exact.push({ userId: pick.userId, username: pick.username });
      else if (base === 1) correct.push({ userId: pick.userId, username: pick.username });
    }
    const byName = (a: ResultBettor, b: ResultBettor) => a.username.localeCompare(b.username);
    exact.sort(byName);
    correct.sort(byName);
    return {
      matchId: match.id,
      stage: match.stage,
      groupLabel: match.groupLabel,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeScore: match.homeScore!,
      awayScore: match.awayScore!,
      kickoffMs: new Date(match.kickoffAt).getTime(),
      multiplier: match.pointsMultiplier,
      exact,
      correct,
      totalPicks: list.length,
      live: match.status === "live",
    };
  });
}

// Every bet a user scored points on, with the match result and points, newest
// first. Powers the per-player hover breakdown on the leaderboard.
export type ScoredBet = {
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  points: number;
  kickoffMs: number;
};

export async function getScoredBetsByUser(): Promise<Record<number, ScoredBet[]>> {
  const rows = await db
    .select({
      userId: bets.userId,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      points: bets.points,
      kickoffAt: matches.kickoffAt,
    })
    .from(bets)
    .innerJoin(matches, eq(matches.id, bets.matchId))
    .where(
      and(
        sql`${bets.points} > 0`,
        isNotNull(matches.homeScore),
        isNotNull(matches.awayScore),
      ),
    )
    .orderBy(desc(matches.kickoffAt));

  const byUser: Record<number, ScoredBet[]> = {};
  for (const row of rows) {
    (byUser[row.userId] ??= []).push({
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      homeScore: row.homeScore!,
      awayScore: row.awayScore!,
      points: row.points!,
      kickoffMs: new Date(row.kickoffAt).getTime(),
    });
  }
  return byUser;
}

// Cumulative points for EVERY player across the finished-match timeline.
// `cumulative[i]` is that player's running total after the i-th finished match.
// Series are sorted by final total (leader first) so the chart can colour the
// top 5. The timeline carries each match's result + top-5 standings (for the
// hover tooltip).
export type ProgressionSeries = {
  userId: number;
  username: string;
  cumulative: number[];
  total: number;
};
export type ProgressionStanding = { username: string; position: number };
export type ProgressionMatch = {
  ms: number;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  maxPoints: number; // points at stake = 3 (a cravada) × the match's multiplier
  top5: ProgressionStanding[]; // standings right after this match
};
export type PointsProgression = {
  timeline: ProgressionMatch[];
  series: ProgressionSeries[];
};

export async function getPointsProgression(): Promise<PointsProgression> {
  const finished = await db
    .select({
      id: matches.id,
      kickoffAt: matches.kickoffAt,
      homeTeam: matches.homeTeam,
      awayTeam: matches.awayTeam,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      pointsMultiplier: matches.pointsMultiplier,
    })
    .from(matches)
    .where(eq(matches.status, "finished"))
    .orderBy(asc(matches.kickoffAt));
  if (finished.length === 0) return { timeline: [], series: [] };

  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      matchId: bets.matchId,
      points: bets.points,
    })
    .from(bets)
    .innerJoin(matches, eq(matches.id, bets.matchId))
    .innerJoin(users, eq(users.id, bets.userId))
    .where(and(eq(matches.status, "finished"), isNotNull(bets.points)));

  // Stake per user — used as a tiebreaker so the top-5 line chart matches the
  // leaderboard table (which sorts points → stake → exact → name).
  const stakeRows = await db
    .select({
      userId: payments.userId,
      stakeCents: sql<number>`coalesce(sum(${payments.amountCents}), 0)`.mapWith(Number),
    })
    .from(payments)
    .where(eq(payments.status, "paid"))
    .groupBy(payments.userId);
  const stakeByUser = new Map<number, number>(stakeRows.map((r) => [r.userId, r.stakeCents]));
  const stake = (id: number) => stakeByUser.get(id) ?? 0;

  const names = new Map<number, string>();
  const perMatch = new Map<string, number>(); // `${userId}:${matchId}` -> points
  for (const row of rows) {
    names.set(row.userId, row.username);
    perMatch.set(`${row.userId}:${row.matchId}`, row.points ?? 0);
  }
  const userIds = [...names.keys()];

  // Walk the timeline, accumulating points per player and the top-5 standings.
  // Sort matches the leaderboard table: points → stake → name.
  const tableSort = (a: number, b: number) =>
    cum.get(b)! - cum.get(a)! ||
    stake(b) - stake(a) ||
    names.get(a)!.localeCompare(names.get(b)!);

  const cum = new Map<number, number>(userIds.map((id) => [id, 0]));
  const cumByUser = new Map<number, number[]>(userIds.map((id) => [id, []]));
  const top5ByMatch: ProgressionStanding[][] = [];
  for (const match of finished) {
    for (const id of userIds) cum.set(id, cum.get(id)! + (perMatch.get(`${id}:${match.id}`) ?? 0));
    for (const id of userIds) cumByUser.get(id)!.push(cum.get(id)!);
    const ranked = [...userIds].sort(tableSort);
    top5ByMatch.push(
      ranked.slice(0, 5).map((id) => ({
        username: names.get(id)!,
        position: 1 + userIds.filter((other) => cum.get(other)! > cum.get(id)!).length,
      })),
    );
  }

  const series: ProgressionSeries[] = userIds
    .map((userId) => ({
      userId,
      username: names.get(userId)!,
      cumulative: cumByUser.get(userId)!,
      total: cum.get(userId)!,
    }))
    .sort((a, b) => b.total - a.total || stake(b.userId) - stake(a.userId) || a.username.localeCompare(b.username));

  const timeline = finished.map((m, i) => ({
    ms: new Date(m.kickoffAt).getTime(),
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    maxPoints: 3 * m.pointsMultiplier,
    top5: top5ByMatch[i],
  }));
  return { timeline, series };
}

// Every player's prediction for one match (for the "ver palpites" modal).
export type MatchBet = { userId: number; username: string; homePred: number; awayPred: number };

export async function getMatchBets(matchId: number): Promise<MatchBet[]> {
  return db
    .select({
      userId: users.id,
      username: users.username,
      homePred: bets.homePred,
      awayPred: bets.awayPred,
    })
    .from(bets)
    .innerJoin(users, eq(users.id, bets.userId))
    .where(eq(bets.matchId, matchId))
    .orderBy(asc(users.username));
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

// Fills in a match's venue once, leaving an existing value untouched. Venue
// (from API-Football) is fixed for the tournament, so we only set it when null.
export async function setMatchVenueIfMissing(matchId: number, venue: string): Promise<number> {
  const rows = await db
    .update(matches)
    .set({ venue })
    .where(and(eq(matches.id, matchId), isNull(matches.venue)))
    .returning({ id: matches.id });
  return rows.length;
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

// The set of match ids that have any unscored bet — one query, so the sync can
// decide rescoring for all matches without a per-match round-trip.
export async function getUnscoredMatchIds(): Promise<Set<number>> {
  const rows = await db
    .selectDistinct({ matchId: bets.matchId })
    .from(bets)
    .where(isNull(bets.points));
  return new Set(rows.map((row) => row.matchId));
}

// Recomputes points for every bet on a match in a SINGLE statement: +3 exact,
// +1 right result, 0 otherwise, times the match's stage/Brazil multiplier. Used
// by the admin result entry and the sync. (A per-bet loop here was the cause of
// /api/sync timing out as finished matches accumulated.)
export async function rescoreMatch(
  matchId: number,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  await db
    .update(bets)
    .set({
      points: sql`(case
        when ${bets.homePred} = ${homeScore} and ${bets.awayPred} = ${awayScore} then 3
        when sign(${bets.homePred} - ${bets.awayPred}) = sign(${homeScore}::int - ${awayScore}::int) then 1
        else 0 end) * coalesce((select ${matches.pointsMultiplier} from ${matches} where ${matches.id} = ${matchId}), 1)`,
    })
    .where(eq(bets.matchId, matchId));
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

// ---- Bets API token ---------------------------------------------------------

// Returns the user's personal API token, minting one on first use.
export async function getOrCreateApiToken(userId: number): Promise<string> {
  const [row] = await db.select({ token: users.apiToken }).from(users).where(eq(users.id, userId));
  if (row?.token) return row.token;
  const token = `blp_${randomBytes(24).toString("hex")}`;
  await db.update(users).set({ apiToken: token }).where(eq(users.id, userId));
  return token;
}

export async function getUserByApiToken(token: string): Promise<User | null> {
  if (!token) return null;
  const rows = await db.select().from(users).where(eq(users.apiToken, token)).limit(1);
  return rows[0] ?? null;
}

// ---- Payments / stakes ------------------------------------------------------

export async function getStakingBounds(): Promise<StakingBounds> {
  const [row] = await db
    .select({
      firstGroup: sql<string | null>`min(${matches.kickoffAt}) filter (where ${matches.stage} = 'group')`,
      lastGroup: sql<string | null>`max(${matches.kickoffAt}) filter (where ${matches.stage} = 'group')`,
      firstKnockout: sql<string | null>`min(${matches.kickoffAt}) filter (where ${matches.stage} = 'round_of_32')`,
      brazilKnockout: sql<string | null>`min(${matches.kickoffAt}) filter (where ${matches.stage} = 'round_of_32' and (${matches.homeTeam} = ${BRAZIL_CODE} or ${matches.awayTeam} = ${BRAZIL_CODE}))`,
    })
    .from(matches);
  const ms = (value: string | null, fallback: number) =>
    value ? new Date(value).getTime() : fallback;
  const firstKnockoutMs = ms(row.firstKnockout, Number.POSITIVE_INFINITY);
  return {
    firstGroupMs: ms(row.firstGroup, Number.POSITIVE_INFINITY),
    lastGroupMs: ms(row.lastGroup, Number.POSITIVE_INFINITY),
    firstKnockoutMs,
    // Until Brazil's R32 fixture exists, keep the original knockout deadline.
    brazilKnockoutMs: ms(row.brazilKnockout, firstKnockoutMs),
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
