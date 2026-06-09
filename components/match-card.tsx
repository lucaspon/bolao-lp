import { Countdown } from "@/components/countdown";
import { BetControls } from "@/components/bet-controls";
import { isLockedAt } from "@/lib/match";
import { formatKickoff } from "@/lib/format";
import type { MatchWithBet } from "@/lib/db/queries";

export function MatchCard({ match }: { match: MatchWithBet }) {
  const kickoffMs = new Date(match.kickoffAt).getTime();
  const finished = match.status === "finished";
  const live = match.status === "live";

  return (
    <article className="rounded-2xl border border-line bg-panel p-4 transition hover:border-line/80">
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
