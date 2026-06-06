"use client";

import { useNow } from "./use-now";
import { formatCountdown } from "@/lib/format";
import { isLockedAt } from "@/lib/match";

// Live "in 3d 4h" countdown. Renders a dash until mounted to avoid a hydration
// mismatch, then ticks every 30s.
export function Countdown({ kickoffMs }: { kickoffMs: number }) {
  const now = useNow();
  if (now === null) return <span className="tabular text-mute">—</span>;

  const locked = isLockedAt(kickoffMs, now);
  return (
    <span className={locked ? "tabular text-mute" : "tabular text-neon"}>
      {formatCountdown(kickoffMs, now)}
    </span>
  );
}
