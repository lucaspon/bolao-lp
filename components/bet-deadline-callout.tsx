"use client";

import { useNowFast } from "@/components/use-now";
import { formatCountdownLong, formatKickoff } from "@/lib/format";

// Shown only during the top-up deposit window — between the last group match and
// the first knockout — counting down (to the second) to when it closes, i.e. when
// the knockouts begin. The page decides when to render it; this hides itself once
// the deadline passes.
export function BetDeadlineCallout({ deadlineMs }: { deadlineMs: number }) {
  // 1s clock (not the shared 30s useNow) so the seconds tick. Null on the server
  // and first client render, so there's no hydration mismatch.
  const now = useNowFast();
  if (now !== null && now >= deadlineMs) return null;

  // Before mount render an absolute time (deterministic), then swap to the live
  // seconds-precision countdown once mounted.
  const when = now === null ? formatKickoff(deadlineMs) : formatCountdownLong(deadlineMs, now);

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
      <span className="text-lg leading-none">💰</span>
      <p className="text-sm">
        <span className="font-semibold text-gold">Janela de reforço aberta</span>
        <span className="text-mute">
          {" "}
          — aumente sua aposta antes do mata-mata. Fecha {when}, quando o mata-mata começa.
        </span>
      </p>
    </div>
  );
}
