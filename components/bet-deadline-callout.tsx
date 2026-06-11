"use client";

import { useNowFast } from "@/components/use-now";
import { formatCountdownLong, formatKickoff } from "@/lib/format";

// Warns how long is left to lock in group-stage predictions. The server picks
// which deadline is live (first match locking, or — once the stage is under way
// — the last); this renders a live countdown to it, ticking every second.
export function BetDeadlineCallout({
  deadlineMs,
  variant,
}: {
  deadlineMs: number;
  variant: "upcoming" | "closing";
}) {
  // 1s clock (not the shared 30s useNow) so the seconds tick. Null on the server
  // and first client render, so there's no hydration mismatch.
  const now = useNowFast();
  if (now !== null && now >= deadlineMs) return null;

  // Before mount render an absolute time (deterministic), then swap to the live
  // seconds-precision countdown once mounted.
  const when = now === null ? formatKickoff(deadlineMs) : formatCountdownLong(deadlineMs, now);

  const headline =
    variant === "closing"
      ? "Última chamada para os depósitos da fase de grupos"
      : "Os depósitos da fase de grupos fecham em breve!";
  const detail =
    variant === "closing"
      ? `os últimos jogos da fase de grupos fecham ${when}, 1h antes do jogo.`
      : `o primeiro jogo começa ${when} (a janela de palpite fecha 1h antes de cada jogo). Não fique de fora!`;

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
