import { MapPin } from "lucide-react";
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

  // Mirrors the match-pill: live = animated yellow border; settled = green (+3),
  // yellow (+1), red (+0); a still-open match within 3h of kickoff = gold warning.
  // (Closing-soon is evaluated at request time — the page is dynamic.)
  const base =
    finished && match.bet && match.homeScore !== null && match.awayScore !== null
      ? scoreBet(match.bet.homePred, match.bet.awayPred, match.homeScore, match.awayScore)
      : null;
  const closingSoon =
    match.status === "scheduled" && teamsKnown && isClosingSoon(kickoffMs);
  const stateClass = live
    ? "live-border bg-panel"
    : !finished && closingSoon
      ? "closing-border bg-panel"
      : cn(
          "border bg-panel",
          finished
            ? base === 3
              ? "border-neon/80"
              : base === 1
                ? "border-gold/60"
                : "border-danger/60"
            : "border-line",
        );

  return (
    <article className={cn("rounded-xl p-3 transition", stateClass)}>
      <header className="mb-2 flex items-center justify-between gap-2 text-[11px] text-mute">
        <span className="flex min-w-0 items-center gap-2">
          {match.groupLabel && (
            <span className="shrink-0 rounded bg-panel2 px-1.5 py-0.5 font-semibold text-ink">
              Grupo {match.groupLabel}
            </span>
          )}
          {match.venue && (
            <span className="flex min-w-0 items-center gap-1 truncate">
              <MapPin size={12} className="shrink-0" />
              {match.venue}
            </span>
          )}
        </span>
        <span className="shrink-0">
          {live ? (
            <span className="flex items-center gap-1 rounded bg-gold/15 px-1.5 py-0.5 font-bold text-gold">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" /> AO VIVO
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

      <div className="mt-2 text-[10px] text-mute">{formatKickoff(match.kickoffAt)}</div>
    </article>
  );
}
