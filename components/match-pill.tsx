"use client";

import { useState, useTransition } from "react";
import { getTeam } from "@/lib/teams";
import { useNow } from "@/components/use-now";
import { placeBetAction } from "@/app/actions/bets";
import { isLockedAt } from "@/lib/match";
import { cn } from "@/lib/utils";

export type PillMatch = {
  id: number;
  kickoffMs: number;
  initialLocked: boolean;
  homeTeam: string | null;
  awayTeam: string | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  homeScore: number | null;
  awayScore: number | null;
  bet: { homePred: number; awayPred: number; points: number | null } | null;
  dateLabel: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

function shortPlaceholder(text: string | null): string {
  if (!text) return "TBD";
  return text
    .replace("Winner Group ", "W")
    .replace("Runner-up Group ", "R")
    .replace("Best 3rd #", "3rd")
    .replace("Winner ", "W ")
    .replace("Loser ", "L ");
}

// One side of a pill: flag + 3-letter code, or a short placeholder for an
// undecided knockout slot.
function Side({
  code,
  placeholder,
  reverse,
}: {
  code: string | null;
  placeholder: string | null;
  reverse?: boolean;
}) {
  const team = getTeam(code);
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1",
        reverse && "flex-row-reverse",
      )}
    >
      <span className="text-sm leading-none">{team ? team.flag : "⚽"}</span>
      <span
        className={cn(
          "font-display font-semibold",
          team ? "text-ink" : "truncate text-mute",
        )}
      >
        {team ? team.code : shortPlaceholder(placeholder)}
      </span>
    </span>
  );
}

function ScoreBox({ children }: { children: React.ReactNode }) {
  return (
    <span className="tabular inline-flex h-5 w-5 items-center justify-center font-display text-sm font-bold text-ink">
      {children}
    </span>
  );
}

export function MatchPill({ match }: { match: PillMatch }) {
  const { bet } = match;
  const finished = match.homeScore !== null && match.awayScore !== null;
  const teamsKnown = !!match.homeTeam && !!match.awayTeam;

  const now = useNow();
  const locked = now === null ? match.initialLocked : isLockedAt(match.kickoffMs, now);
  const editable = teamsKnown && !finished && !locked;

  const [home, setHome] = useState(bet?.homePred?.toString() ?? "");
  const [away, setAway] = useState(bet?.awayPred?.toString() ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [, startTransition] = useTransition();

  function maybeSave() {
    if (home === "" || away === "") return;
    const h = Number(home);
    const a = Number(away);
    if (h === bet?.homePred && a === bet?.awayPred) return; // unchanged
    setStatus("saving");
    startTransition(async () => {
      const result = await placeBetAction(match.id, h, a);
      setStatus(result.ok ? "saved" : "error");
    });
  }

  const borderClass = finished
    ? bet?.points === 3
      ? "border-gold/50"
      : bet?.points === 1
        ? "border-neon/50"
        : "border-line"
    : !teamsKnown
      ? "border-line/50"
      : locked
        ? "border-line"
        : bet
          ? "border-neon/40"
          : "border-line";

  // Status text for the second line.
  let statusLabel: string;
  if (finished) {
    statusLabel = bet?.points != null ? `FT · +${bet.points}p` : "FT";
  } else if (!teamsKnown) {
    statusLabel = "TBD";
  } else if (locked) {
    statusLabel = "🔒 locked";
  } else if (status === "saving") {
    statusLabel = "saving…";
  } else if (status === "saved") {
    statusLabel = "saved ✓";
  } else if (status === "error") {
    statusLabel = "error";
  } else {
    statusLabel = bet ? "saved" : "open";
  }

  return (
    <div className={cn("rounded-lg border bg-panel px-2 py-1.5", borderClass)}>
      <div className="flex items-center justify-between gap-1 text-[11px]">
        <Side code={match.homeTeam} placeholder={match.homePlaceholder} />

        <span className="flex shrink-0 items-center">
          {editable ? (
            <input
              inputMode="numeric"
              maxLength={2}
              value={home}
              aria-label="home score"
              onChange={(event) => setHome(event.target.value.replace(/\D/g, ""))}
              onBlur={maybeSave}
              onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
              className="tabular h-5 w-5 rounded border border-line bg-base text-center text-sm font-bold outline-none focus:border-neon"
            />
          ) : (
            <ScoreBox>{finished ? match.homeScore : (bet?.homePred ?? "–")}</ScoreBox>
          )}
          <span className="px-0.5 text-mute">×</span>
          {editable ? (
            <input
              inputMode="numeric"
              maxLength={2}
              value={away}
              aria-label="away score"
              onChange={(event) => setAway(event.target.value.replace(/\D/g, ""))}
              onBlur={maybeSave}
              onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
              className="tabular h-5 w-5 rounded border border-line bg-base text-center text-sm font-bold outline-none focus:border-neon"
            />
          ) : (
            <ScoreBox>{finished ? match.awayScore : (bet?.awayPred ?? "–")}</ScoreBox>
          )}
        </span>

        <Side code={match.awayTeam} placeholder={match.awayPlaceholder} reverse />
      </div>

      <div className="mt-1 truncate text-center text-[10px] text-mute">
        {match.dateLabel} · {statusLabel}
      </div>
    </div>
  );
}
