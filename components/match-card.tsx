import { Countdown } from "@/components/countdown";
import { BetControls } from "@/components/bet-controls";
import { isLockedAt, isClosingSoon } from "@/lib/match";
import { scoreBet } from "@/lib/scoring";
import { formatKickoff } from "@/lib/format";
import type { MatchWithBet } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

export function MatchCard({ match }: { match: MatchWithBet }) {
  const kickoffMs = new Date(match.kickoffAt).getTime();
  const finished = match.status === "finished";
  const live = match.status === "live";
  const teamsKnown = !!match.homeTeam && !!match.awayTeam;

  // Border mirrors the match-pill: live = red, finished = by points, a still-open
  // match within 3h of kickoff = gold warning. (Closing-soon is evaluated at
  // request time — the page is dynamic, so it's accurate on load.)
  const base =
    finished && match.bet && match.homeScore !== null && match.awayScore !== null
      ? scoreBet(match.bet.homePred, match.bet.awayPred, match.homeScore, match.awayScore)
      : null;
  const closingSoon =
    match.status === "scheduled" && teamsKnown && isClosingSoon(kickoffMs);
  const border = live
    ? "border-danger/70"
    : finished
      ? base === 3
        ? "border-gold/60"
        : base === 1
          ? "border-neon/60"
          : "border-line"
      : closingSoon
        ? "border-gold/70"
        : "border-line";

  return (
    <article
      className={cn(
        "rounded-2xl border bg-panel p-4 transition",
        border,
        live && "bg-danger/5",
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-2 text-xs text-mute">
        <span className="flex min-w-0 items-center gap-2">
          {match.groupLabel && (
            <span className="shrink-0 rounded bg-panel2 px-1.5 py-0.5 font-semibold text-ink">
              Grupo {match.groupLabel}
            </span>
          )}
          <span className="truncate">{match.venue}</span>
        </span>
        <span className="shrink-0">
          {live ? (
            <span className="flex items-center gap-1 rounded bg-danger/15 px-1.5 py-0.5 font-bold text-danger">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" /> AO VIVO
            </span>
          ) : finished ? (
            <span className="rounded bg-neon/15 px-1.5 py-0.5 font-bold text-neon">FIM</span>
          ) : (
            <Countdown kickoffMs={kickoffMs} />
          )}
        </span>
      </header>

      <BetControls
        matchId={match.id}
        kickoffMs={kickoffMs}
        initialLocked={isLockedAt(kickoffMs)}
        status={match.status}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        homePlaceholder={match.homePlaceholder}
        awayPlaceholder={match.awayPlaceholder}
        homeScore={match.homeScore}
        awayScore={match.awayScore}
        bet={match.bet}
      />

      <div className="mt-2.5 text-[11px] text-mute">{formatKickoff(match.kickoffAt)}</div>
    </article>
  );
}
