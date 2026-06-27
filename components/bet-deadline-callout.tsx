"use client";

import { useNowFast } from "@/components/use-now";
import { formatCountdownLong, formatKickoff } from "@/lib/format";

// `opens`: deadline is when the top-up window opens (group_running phase).
// `!opens`: deadline is when it closes (topup phase — original behaviour).
export function BetDeadlineCallout({
  deadlineMs,
  opens = false,
}: {
  deadlineMs: number;
  opens?: boolean;
}) {
  const now = useNowFast();
  if (now !== null && now >= deadlineMs) return null;

  const when = now === null ? formatKickoff(deadlineMs) : formatCountdownLong(deadlineMs, now);

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
      <span className="text-lg leading-none">💰</span>
      <p className="text-sm">
        {opens ? (
          <>
            <span className="font-semibold text-gold">Janela de reforço abre em breve</span>
            <span className="text-mute">
              {" "}
              — você poderá aumentar sua aposta ao final da fase de grupos. Abre {when}.
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold text-gold">Janela de reforço aberta</span>
            <span className="text-mute">
              {" "}
              — aumente sua aposta antes do mata-mata. Fecha {when}, quando o mata-mata começa.
            </span>
          </>
        )}
      </p>
    </div>
  );
}
