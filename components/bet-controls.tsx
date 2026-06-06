"use client";

import { useState, useTransition } from "react";
import { Lock, Minus, Plus, Check } from "lucide-react";
import { TeamBadge } from "@/components/team-badge";
import { useNow } from "@/components/use-now";
import { placeBetAction } from "@/app/actions/bets";
import { isLockedAt } from "@/lib/match";
import type { MatchStatus } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export type BetControlsProps = {
  matchId: number;
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
};

const MAX_SCORE = 30;

function PointsBadge({ points }: { points: number | null }) {
  if (points === null) return null;
  if (points === 3) {
    return (
      <span className="rounded-md bg-gold/15 px-2 py-0.5 text-xs font-bold tracking-wide text-gold">
        EXACT · +3
      </span>
    );
  }
  if (points === 1) {
    return (
      <span className="rounded-md bg-neon/15 px-2 py-0.5 text-xs font-bold text-neon">
        WINNER · +1
      </span>
    );
  }
  return (
    <span className="rounded-md bg-panel2 px-2 py-0.5 text-xs font-semibold text-mute">
      +0
    </span>
  );
}

function Stepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="decrease"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-mute hover:text-ink disabled:opacity-30"
      >
        <Minus size={14} />
      </button>
      <span className="tabular w-7 text-center font-display text-2xl font-bold text-ink">
        {value}
      </span>
      <button
        type="button"
        aria-label="increase"
        disabled={disabled || value >= MAX_SCORE}
        onClick={() => onChange(Math.min(MAX_SCORE, value + 1))}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-mute hover:text-ink disabled:opacity-30"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export function BetControls(props: BetControlsProps) {
  const { matchId, kickoffMs, bet } = props;
  const finished = props.status === "finished";
  const live = props.status === "live";
  const showActual = finished || live;
  const teamsKnown = !!props.homeTeam && !!props.awayTeam;

  const [home, setHome] = useState(bet?.homePred ?? 0);
  const [away, setAway] = useState(bet?.awayPred ?? 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(false);

  // Lock state is derived from the live clock; falls back to the server's value
  // until the component mounts.
  const now = useNow();
  const locked = now === null ? props.initialLocked : isLockedAt(kickoffMs, now);

  const dirty = !bet || bet.homePred !== home || bet.awayPred !== away;

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await placeBetAction(matchId, home, away);
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1800);
    });
  }

  const editable = teamsKnown && props.status === "scheduled" && !locked;

  return (
    <div suppressHydrationWarning className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <TeamBadge
          code={props.homeTeam}
          placeholder={props.homePlaceholder}
          className="flex-1"
        />

        <div className="flex shrink-0 flex-col items-center gap-1.5">
          {showActual ? (
            <div
              className={cn(
                "tabular font-display text-3xl font-bold",
                live ? "text-danger" : "text-ink",
              )}
            >
              {props.homeScore}
              <span className="px-1.5 text-mute">:</span>
              {props.awayScore}
            </div>
          ) : editable ? (
            <div className="flex items-center gap-2">
              <Stepper value={home} onChange={setHome} disabled={pending} />
              <span className="text-mute">:</span>
              <Stepper value={away} onChange={setAway} disabled={pending} />
            </div>
          ) : (
            <div className="tabular font-display text-3xl font-bold text-mute">
              {bet ? bet.homePred : "–"}
              <span className="px-1.5">:</span>
              {bet ? bet.awayPred : "–"}
            </div>
          )}
        </div>

        <TeamBadge
          code={props.awayTeam}
          placeholder={props.awayPlaceholder}
          align="right"
          className="flex-1"
        />
      </div>

      <Footer
        finished={finished}
        live={live}
        teamsKnown={teamsKnown}
        locked={locked}
        dirty={dirty}
        pending={pending}
        savedTick={savedTick}
        error={error}
        bet={bet}
        onSave={save}
      />
    </div>
  );
}

function Footer({
  finished,
  live,
  teamsKnown,
  locked,
  dirty,
  pending,
  savedTick,
  error,
  bet,
  onSave,
}: {
  finished: boolean;
  live: boolean;
  teamsKnown: boolean;
  locked: boolean;
  dirty: boolean;
  pending: boolean;
  savedTick: boolean;
  error: string | null;
  bet: BetControlsProps["bet"];
  onSave: () => void;
}) {
  if (live) {
    return (
      <div className="flex items-center justify-between border-t border-line pt-2.5 text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-danger">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" /> LIVE
        </span>
        <span className="text-mute">
          {bet ? `Your pick: ${bet.homePred}–${bet.awayPred}` : "No prediction"}
        </span>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex items-center justify-between border-t border-line pt-2.5 text-sm">
        <span className="text-mute">
          {bet ? `Your pick: ${bet.homePred}–${bet.awayPred}` : "No prediction"}
        </span>
        {bet ? <PointsBadge points={bet.points} /> : null}
      </div>
    );
  }

  if (!teamsKnown) {
    return (
      <div className="border-t border-line pt-2.5 text-sm text-mute">
        Teams to be decided — betting opens once the bracket is set.
      </div>
    );
  }

  if (locked) {
    return (
      <div className="flex items-center justify-between border-t border-line pt-2.5 text-sm">
        <span className="flex items-center gap-1.5 text-mute">
          <Lock size={13} /> Locked
        </span>
        <span className="text-mute">
          {bet ? `Your pick: ${bet.homePred}–${bet.awayPred}` : "No prediction made"}
        </span>
      </div>
    );
  }

  // editable
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
      <span className="text-xs text-mute">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : bet ? (
          "You can edit until 1h before kickoff"
        ) : (
          "Make your prediction"
        )}
      </span>
      <button
        type="button"
        onClick={onSave}
        disabled={pending || (!dirty && !!bet)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition",
          savedTick
            ? "bg-neon/20 text-neon"
            : "bg-neon text-base hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100",
        )}
      >
        {savedTick ? (
          <>
            <Check size={15} /> Saved
          </>
        ) : pending ? (
          "Saving…"
        ) : bet ? (
          "Update pick"
        ) : (
          "Save pick"
        )}
      </button>
    </div>
  );
}
