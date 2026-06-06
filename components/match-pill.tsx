"use client";

import { useRef, useState, useTransition } from "react";
import { getTeam } from "@/lib/teams";
import { useNow } from "@/components/use-now";
import { usePillKeyboard, type Side } from "@/components/keyboard-bet";
import { placeBetAction, clearBetAction } from "@/app/actions/bets";
import { isLockedAt } from "@/lib/match";
import type { MatchStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export type PillMatch = {
  id: number;
  kickoffMs: number;
  initialLocked: boolean;
  status: MatchStatus;
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
    <span className={cn("flex min-w-0 items-center gap-1", reverse && "flex-row-reverse")}>
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

function ScoreBox({ children, live }: { children: React.ReactNode; live?: boolean }) {
  return (
    <span
      className={cn(
        "tabular inline-flex h-5 w-5 items-center justify-center font-display text-sm font-bold",
        live ? "text-danger" : "text-ink",
      )}
    >
      {children}
    </span>
  );
}

export function MatchPill({ match, className }: { match: PillMatch; className?: string }) {
  const { bet } = match;
  const finished = match.status === "finished";
  const live = match.status === "live";
  const showActual = finished || live;
  const teamsKnown = !!match.homeTeam && !!match.awayTeam;
  const isBrazil = match.homeTeam === BRAZIL || match.awayTeam === BRAZIL;

  const now = useNow();
  const locked = now === null ? match.initialLocked : isLockedAt(match.kickoffMs, now);
  const editable = teamsKnown && match.status === "scheduled" && !locked;

  const [home, setHome] = useState(bet?.homePred?.toString() ?? "");
  const [away, setAway] = useState(bet?.awayPred?.toString() ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [, startTransition] = useTransition();

  function commit(h: string, a: string) {
    if (h === "" || a === "") return;
    const hn = Number(h);
    const an = Number(a);
    if (hn === bet?.homePred && an === bet?.awayPred) return; // unchanged
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

  const borderClass = live
    ? "border-danger/70"
    : finished
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

  let statusLabel: string;
  if (live) {
    statusLabel = bet ? `LIVE · pick ${bet.homePred}–${bet.awayPred}` : "LIVE";
  } else if (finished) {
    statusLabel = bet?.points != null ? `FT · +${bet.points}p` : "FT";
  } else if (!teamsKnown) {
    statusLabel = "TBD";
  } else if (locked) {
    statusLabel = "🔒 locked";
  } else if (saveStatus === "saving") {
    statusLabel = "saving…";
  } else if (saveStatus === "saved") {
    statusLabel = "saved ✓";
  } else if (saveStatus === "error") {
    statusLabel = "error";
  } else {
    statusLabel = bet ? "saved" : "open";
  }

  function scoreInput(side: Side, value: string, setValue: (next: string) => void) {
    return (
      <input
        inputMode="numeric"
        maxLength={2}
        value={value}
        aria-label={`${side} score`}
        onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))}
        onBlur={() => commit(home, away)}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
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
        "rounded-lg px-2 py-1.5 outline-none transition",
        isBrazil ? "brazil-border" : cn("border bg-panel", borderClass),
        kb.editing
          ? "ring-2 ring-neon"
          : kb.selected
            ? "ring-2 ring-neon/50"
            : "",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-1 text-[11px]">
        <Side_ code={match.homeTeam} placeholder={match.homePlaceholder} />

        <span className="flex shrink-0 items-center">
          {editable ? scoreInput("home", home, setHome) : (
            <ScoreBox live={live}>{showActual ? match.homeScore : (bet?.homePred ?? "–")}</ScoreBox>
          )}
          <span className="px-0.5 text-mute">×</span>
          {editable ? scoreInput("away", away, setAway) : (
            <ScoreBox live={live}>{showActual ? match.awayScore : (bet?.awayPred ?? "–")}</ScoreBox>
          )}
        </span>

        <Side_ code={match.awayTeam} placeholder={match.awayPlaceholder} reverse />
      </div>

      <div
        className={cn(
          "mt-1 truncate text-center text-[10px]",
          live ? "font-semibold text-danger" : "text-mute",
        )}
      >
        {live && <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-danger align-middle" />}
        {match.dateLabel} · {statusLabel}
      </div>
    </div>
  );
}
