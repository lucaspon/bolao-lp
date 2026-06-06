import type { Match, Stage } from "./db/schema";

// Bets lock one hour before kickoff.
export const BET_LOCK_MS = 60 * 60 * 1000;

export const STAGES: { key: Stage; label: string; short: string }[] = [
  { key: "group", label: "Group Stage", short: "Groups" },
  { key: "round_of_32", label: "Round of 32", short: "R32" },
  { key: "round_of_16", label: "Round of 16", short: "R16" },
  { key: "quarter", label: "Quarter-finals", short: "QF" },
  { key: "semi", label: "Semi-finals", short: "SF" },
  { key: "third_place", label: "Third place", short: "3rd" },
  { key: "final", label: "Final", short: "Final" },
];

export const STAGE_LABEL: Record<Stage, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label]),
) as Record<Stage, string>;

export function isLockedAt(kickoffMs: number, now: number = Date.now()): boolean {
  return now >= kickoffMs - BET_LOCK_MS;
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
