import type { Match, Stage } from "./db/schema";

// Bets lock one hour before kickoff.
export const BET_LOCK_MS = 60 * 60 * 1000;

export const STAGES: { key: Stage; label: string; short: string }[] = [
  { key: "group", label: "Fase de Grupos", short: "Grupos" },
  { key: "round_of_32", label: "16-avos de final", short: "16-avos" },
  { key: "round_of_16", label: "Oitavas de final", short: "Oitavas" },
  { key: "quarter", label: "Quartas de final", short: "Quartas" },
  { key: "semi", label: "Semifinais", short: "Semis" },
  { key: "third_place", label: "Disputa de 3º lugar", short: "3º lugar" },
  { key: "final", label: "Final", short: "Final" },
];

export const STAGE_LABEL: Record<Stage, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
) as Record<Stage, string>;

// Per-match points multiplier by stage ("Balanced" curve): later rounds are
// worth more, so the group stage stops swamping the total. Base points (+3
// exact / +1 result) are multiplied by this.
export const STAGE_WEIGHT: Record<Stage, number> = {
  group: 1,
  round_of_32: 2,
  round_of_16: 3,
  quarter: 5,
  semi: 8,
  third_place: 5,
  final: 13,
};

// Brazil matches are worth double — on top of the stage weight.
export const BRAZIL_CODE = "BRA";
export const BRAZIL_POINTS_MULTIPLIER = 2;

// The per-match points multiplier stored on each match: the stage weight, doubled
// whenever Brazil is playing. Applied to the base score (+3 exact / +1 result),
// so it flows through scoring, the leaderboard, payouts and percentages.
export function matchPointsMultiplier(
  stage: Stage,
  homeTeam: string | null,
  awayTeam: string | null,
): number {
  const isBrazil = homeTeam === BRAZIL_CODE || awayTeam === BRAZIL_CODE;
  return STAGE_WEIGHT[stage] * (isBrazil ? BRAZIL_POINTS_MULTIPLIER : 1);
}

export function isLockedAt(kickoffMs: number, now: number = Date.now()): boolean {
  return now >= kickoffMs - BET_LOCK_MS;
}

// The palpite window closes 1h before kickoff; we warn for the 2h before that.
export const BET_CLOSING_SOON_MS = 3 * 60 * 60 * 1000;

// True while a still-open match is within 3h of kickoff (but not yet locked).
export function isClosingSoon(kickoffMs: number, now: number = Date.now()): boolean {
  return !isLockedAt(kickoffMs, now) && now >= kickoffMs - BET_CLOSING_SOON_MS;
}

export function isFinished(match: Pick<Match, "status">): boolean {
  return match.status === "finished";
}

export function isLive(match: Pick<Match, "status">): boolean {
  return match.status === "live";
}

export function teamsKnown(match: Pick<Match, "homeTeam" | "awayTeam">): boolean {
  return !!match.homeTeam && !!match.awayTeam;
}

// A match accepts bets when both teams are known, it has not started, and
// kickoff is more than an hour away.
export function canBet(match: Match): boolean {
  return (
    teamsKnown(match) &&
    match.status === "scheduled" &&
    !isLockedAt(new Date(match.kickoffAt).getTime())
  );
}
