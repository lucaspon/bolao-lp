import type { LeaderRow } from "./db/queries";

// Top-3 skill podium among payers; the pot is split in proportion to
// (points × stake). Everyone else gets 0. `metric` lets us project payouts from
// live (in-play) points as well as the official total.
export function computePayouts(
  rows: LeaderRow[],
  potCents: number,
  metric: "points" | "livePoints" = "points",
): Map<number, number> {
  const payers = rows.filter((row) => row.stakeCents > 0);
  const ranked = [...payers].sort(
    (a, b) =>
      b[metric] - a[metric] ||
      b.exact - a.exact ||
      b.stakeCents - a.stakeCents ||
      a.username.localeCompare(b.username),
  );
  const top3 = ranked.slice(0, 3);

  const weights = top3.map((row) => ({ userId: row.userId, weight: row[metric] * row.stakeCents }));
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  const payouts = new Map<number, number>();
  if (totalWeight <= 0) return payouts; // nobody has scored yet
  for (const { userId, weight } of weights) {
    payouts.set(userId, Math.round((potCents * weight) / totalWeight));
  }
  return payouts;
}
