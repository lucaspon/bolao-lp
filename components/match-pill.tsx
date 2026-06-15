"use client";

import { useRef, useState, useTransition } from "react";
import { MapPin } from "lucide-react";
import { getTeam } from "@/lib/teams";
import { HoverTip } from "@/components/hover-tip";
import { useNow } from "@/components/use-now";
import { usePillKeyboard, type Side } from "@/components/keyboard-bet";
import { placeBetAction, clearBetAction } from "@/app/actions/bets";
import { isLockedAt, isClosingSoon } from "@/lib/match";
import { scoreBet } from "@/lib/scoring";
import type { MatchStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export type PillMatch = {
  id: number;
  kickoffMs: number;
  initialLocked: boolean;
  initialClosingSoon: boolean;
  status: MatchStatus;
  homeTeam: string | null;
  awayTeam: string | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  homeScore: number | null;
  awayScore: number | null;
  bet: { homePred: number; awayPred: number; points: number | null } | null;
  dateLabel: string;
  venue: string | null;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const BRAZIL = "BRA";

function shortPlaceholder(text: string | null): string {
  if (!text) return "TBD";
  return text
    .replace("Winner Group ", "W")
    .replace("Runner-up Group ", "R")
    .replace("Best 3rd #", "3rd")
    .replace("Winner ", "W ")
    .replace("Loser ", "L ");
}

function clampScore(prev: string, delta: number): string {
  const base = prev === "" ? 0 : Number(prev);
  return String(Math.max(0, Math.min(30, base + delta)));
}

// Both sides take flex-1 so the score block is always exactly centred.
function Side_({
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
    <HoverTip
      label={team?.name}
      className={cn(
        "flex flex-1 min-w-0 items-center gap-1",
        reverse ? "flex-row-reverse" : "",
      )}
    >
      <span className="shrink-0 text-sm leading-none">
        {team ? team.flag : "⚽"}
      </span>
      <span
        className={cn(
          "truncate font-display text-[11px] font-semibold",
          team ? "text-ink" : "text-mute",
        )}
      >
        {team ? team.code : shortPlaceholder(placeholder)}
      </span>
    </HoverTip>
  );
}

function ScoreBox({
  children,
  live,
}: {
  children: React.ReactNode;
  live?: boolean;
}) {
  return (
    <span
      className={cn(
        "tabular inline-flex h-5 w-5 shrink-0 items-center justify-center font-display text-sm font-bold",
        live ? "text-gold" : "text-ink",
      )}
    >
      {children}
    </span>
  );
}

export function MatchPill({
  match,
  className,
  emphasis,
}: {
  match: PillMatch;
  className?: string;
  emphasis?: boolean;
}) {
  const { bet } = match;
  const finished = match.status === "finished";
  const live = match.status === "live";
  const showActual = finished || live;
  const teamsKnown = !!match.homeTeam && !!match.awayTeam;
  const isBrazil = match.homeTeam === BRAZIL || match.awayTeam === BRAZIL;

  const now = useNow();
  const locked =
    now === null ? match.initialLocked : isLockedAt(match.kickoffMs, now);
  const editable = teamsKnown && match.status === "scheduled" && !locked;
  const closingSoon =
    editable &&
    (now === null
      ? match.initialClosingSoon
      : isClosingSoon(match.kickoffMs, now));

  const [home, setHome] = useState(bet?.homePred?.toString() ?? "");
  const [away, setAway] = useState(bet?.awayPred?.toString() ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [, startTransition] = useTransition();

  function commit(h: string, a: string) {
    if (h === "" || a === "") return;
    const hn = Number(h);
    const an = Number(a);
    if (hn === bet?.homePred && an === bet?.awayPred) return;
    setSaveStatus("saving");
    startTransition(async () => {
      const result = await placeBetAction(match.id, hn, an);
      setSaveStatus(result.ok ? "saved" : "error");
    });
  }

  function adjust(side: Side, delta: number) {
    if (side === "home") setHome((value) => clampScore(value, delta));
    else setAway((value) => clampScore(value, delta));
  }

  function setScore(side: Side, value: number) {
    if (side === "home") setHome(String(value));
    else setAway(String(value));
  }

  function clear() {
    setHome("");
    setAway("");
    if (!bet) {
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("saving");
    startTransition(async () => {
      const result = await clearBetAction(match.id);
      setSaveStatus(result.ok ? "idle" : "error");
    });
  }

  const pillRef = useRef<HTMLDivElement>(null);
  const kb = usePillKeyboard(pillRef, {
    id: match.id,
    editable,
    adjust,
    setScore,
    save: () => commit(home, away),
    clear,
  });

  const base =
    finished && bet && match.homeScore !== null && match.awayScore !== null
      ? scoreBet(bet.homePred, bet.awayPred, match.homeScore, match.awayScore)
      : null;

  const borderClass = finished
    ? base === 3
      ? "border-neon/80"
      : base === 1
        ? "border-gold/60"
        : "border-danger/60"
    : !teamsKnown
      ? "border-line/50"
      : "border-line"; // closingSoon is handled by .closing-border on the container

  let statusLabel: string;
  if (live) {
    statusLabel = "AO VIVO";
  } else if (finished) {
    statusLabel = bet?.points != null ? `FIM · +${bet.points}p` : "FIM";
  } else if (!teamsKnown) {
    statusLabel = "A definir";
  } else if (locked) {
    statusLabel = "🔒 fechado";
  } else if (saveStatus === "saving") {
    statusLabel = "salvando…";
  } else if (saveStatus === "saved") {
    statusLabel = "salvo ✓";
  } else if (saveStatus === "error") {
    statusLabel = "erro";
  } else if (closingSoon) {
    statusLabel = bet ? "⏳ fecha logo" : "⏳ aposte já";
  } else {
    statusLabel = bet ? "salvo" : "aberto";
  }

  function scoreInput(
    side: Side,
    value: string,
    setValue: (next: string) => void,
  ) {
    return (
      <input
        inputMode="numeric"
        maxLength={2}
        value={value}
        aria-label={`${side} score`}
        onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))}
        onBlur={() => commit(home, away)}
        onKeyDown={(event) =>
          event.key === "Enter" && event.currentTarget.blur()
        }
        className={cn(
          "tabular h-5 w-5 rounded border bg-base text-center text-sm font-bold outline-none",
          kb.editing && kb.activeSide === side
            ? "border-neon ring-1 ring-neon"
            : "border-line focus:border-neon",
        )}
      />
    );
  }

  return (
    <div
      ref={pillRef}
      data-bet-pill=""
      tabIndex={-1}
      onMouseDown={() => kb.select?.(match.id)}
      className={cn(
        "flex min-h-[68px] flex-col rounded-lg px-2 py-2 outline-none transition",
        live
          ? "live-border bg-panel"
          : isBrazil && !finished
            ? "brazil-border"
            : closingSoon
              ? "closing-border bg-panel"
              : cn(
                  "border bg-panel",
                  emphasis && !finished ? "border-gold/60" : borderClass,
                ),
        kb.editing
          ? "ring-2 ring-neon"
          : kb.selected
            ? "ring-2 ring-mute/60"
            : "",
        className,
      )}
    >
      {/* Rows centred as a block. `my-auto` distributes any leftover vertical
          space evenly above and below when pills sit in a taller grid cell. The
          "seu palpite" row only renders for live/finished matches, so pending
          pills don't reserve empty space for it. */}
      <div className="my-auto flex flex-col items-center gap-1">
        {/* Score row — flex-1 sides guarantee the score is exactly centred */}
        <div className="flex w-full items-center gap-1">
          <Side_ code={match.homeTeam} placeholder={match.homePlaceholder} />

          <span className="flex shrink-0 items-center">
            {editable ? (
              scoreInput("home", home, setHome)
            ) : (
              <ScoreBox live={live}>
                {showActual ? match.homeScore : (bet?.homePred ?? "–")}
              </ScoreBox>
            )}
            <span className="px-0.5 text-[10px] text-mute">–</span>
            {editable ? (
              scoreInput("away", away, setAway)
            ) : (
              <ScoreBox live={live}>
                {showActual ? match.awayScore : (bet?.awayPred ?? "–")}
              </ScoreBox>
            )}
          </span>

          <Side_
            code={match.awayTeam}
            placeholder={match.awayPlaceholder}
            reverse
          />
        </div>

        {/* Seu palpite — only rendered for live/finished matches with a bet, so
            pending pills take no space for it. */}
        {showActual && bet && (
          <div className="text-center text-[9px] leading-none text-mute">
            seu palpite {bet.homePred}–{bet.awayPred}
          </div>
        )}

        {/* Date + status */}
        <div
          className={cn(
            "truncate text-center text-[10px]",
            live ? "font-semibold text-gold" : "text-mute",
          )}
        >
          {live && (
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-gold align-middle" />
          )}
          {match.dateLabel} · {statusLabel}
        </div>

        {/* Location — only once the venue is known (filled progressively). */}
        {match.venue && (
          <div className="flex max-w-full items-center gap-0.5 truncate text-center text-[9px] text-mute/80">
            <MapPin size={9} className="shrink-0" />
            <span className="truncate">{match.venue}</span>
          </div>
        )}
      </div>
    </div>
  );
}
