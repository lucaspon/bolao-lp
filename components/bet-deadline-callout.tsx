"use client";

import { useNow } from "@/components/use-now";
import { formatCountdown, formatKickoff } from "@/lib/format";

// Warns how long is left to lock in group-stage predictions. The server picks
// which deadline is live (first match locking, or — once the stage is under way
// — the last); this just renders the live countdown to it.
export function BetDeadlineCallout({
  deadlineMs,
  variant,
}: {
  deadlineMs: number;
  variant: "upcoming" | "closing";
}) {
  const now = useNow();
  if (now !== null && now >= deadlineMs) return null;

  // Before mount `now` is null on both server and client, so render an absolute
  // time (deterministic, no hydration mismatch) and swap to a live relative
  // countdown once mounted.
  const when = now === null ? `on ${formatKickoff(deadlineMs)}` : formatCountdown(deadlineMs, now);

  const headline = variant === "closing" ? "Last call for group-stage bets" : "Group-stage bets close soon";
  const detail =
    variant === "closing"
      ? `the final group matches lock ${when}, 1h before kickoff.`
      : `the first match locks ${when} (bets close 1h before each kickoff). Lock in your group picks!`;

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
      <span className="text-lg leading-none">⏳</span>
      <p className="text-sm">
        <span className="font-semibold text-gold">{headline}</span>
        <span className="text-mute"> — {detail}</span>
      </p>
    </div>
  );
}
