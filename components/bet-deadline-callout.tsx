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
  const when =
    now === null
      ? `on ${formatKickoff(deadlineMs)}`
      : formatCountdown(deadlineMs, now);

  const headline =
    variant === "closing"
      ? "Última chamada para as apostas da fase de grupos"
      : "As apostas da fase de grupos fecham em breve!";
  const detail =
    variant === "closing"
      ? `os últimos jogos da fase de grupos fecham ${when}, 1h antes do jogo.`
      : `o primeiro jogo começa ${when} (as apostas fecham 1h antes de cada jogo). Não fique de fora!`;

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
