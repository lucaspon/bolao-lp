import type { LeaderRow } from "./db/queries";

// Top-3 skill podium among payers; the pot is split by a PHASE-LOCKED weight:
// group-stage points ride on the stake committed before the group stage, while
// knockout points ride on the (possibly topped-up) total stake. So a late top-up
// can't retroactively inflate group results. Everyone outside the top 3 gets 0.
// `metric` projects payouts from live (in-play) points too.
export function computePayouts(
  rows: LeaderRow[],
  potCents: number,
  metric: "points" | "livePoints" = "points",
): Map<number, number> {
  const live = metric === "livePoints";
  const totalPoints = (row: LeaderRow) => (live ? row.livePoints : row.points);
  const groupPoints = (row: LeaderRow) => (live ? row.groupLivePoints : row.groupPoints);
  const koPoints = (row: LeaderRow) => (live ? row.koLivePoints : row.koPoints);
  const weightOf = (row: LeaderRow) =>
    groupPoints(row) * row.stakeW1Cents + koPoints(row) * row.stakeCents;

  const payers = rows.filter((row) => row.stakeCents > 0);
  const ranked = [...payers].sort(
    (a, b) =>
      totalPoints(b) - totalPoints(a) ||
      b.exact - a.exact ||
      b.stakeCents - a.stakeCents ||
      a.username.localeCompare(b.username),
  );

  // Top 3 by score, but literal ties at the 3rd-place score widen the pool:
  // anyone at or above the 3rd-highest score qualifies (so 1,2,3,3 → 4 winners).
  const scored = ranked.filter((row) => totalPoints(row) > 0);
  const cutoff = scored.length > 0 ? totalPoints(scored[Math.min(3, scored.length) - 1]) : 0;
  const qualifiers = scored.filter((row) => totalPoints(row) >= cutoff);

  const weights = qualifiers.map((row) => ({ userId: row.userId, weight: weightOf(row) }));
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  const payouts = new Map<number, number>();
  if (totalWeight <= 0) return payouts; // nobody has scored yet
  for (const { userId, weight } of weights) {
    payouts.set(userId, Math.round((potCents * weight) / totalWeight));
  }
  return payouts;
}
