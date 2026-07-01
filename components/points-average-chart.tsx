"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PointsProgression } from "@/lib/db/queries";
import { TOP5_COLORS, GOLD, GRAY, fmtDate, code, smoothPath } from "@/components/points-chart";

const WINDOW = 8;

// Rolling "aproveitamento" over a fixed `window` of finished matches: points won
// as a share of the points that were at stake. Normalising by stake makes it
// comparable across stages — a cravada in the final and in a group game both
// count as 100% for that match. Derived from the cumulative series (per-match
// points = consecutive diffs) plus each match's max-at-stake, so no extra query.
// Only defined once a full window exists, so index i < window-1 stays undefined.
function rollingRatio(cumulative: number[], stake: number[], window: number): number[] {
  const earned = cumulative.map((value, i) => value - (i > 0 ? cumulative[i - 1] : 0));
  return earned.map((_, i) => {
    let won = 0;
    let atStake = 0;
    for (let j = i - window + 1; j <= i; j++) {
      won += earned[j];
      atStake += stake[j];
    }
    return atStake > 0 ? won / atStake : 0;
  });
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

// Inline SVG line chart mirroring PointsChart's formatting, but plotting each
// player's rolling aproveitamento (% of available points won) over a fixed
// 8-match window. The line only begins once 8 matches have been played (the
// first full window). Same top-5 colouring, gold for the logged-in user.
export function PointsAverageChart({
  progression,
  meId,
}: {
  progression: PointsProgression;
  meId: number;
}) {
  const { timeline, series } = progression;
  const [hover, setHover] = useState<number | null>(null);

  const M = timeline.length;
  const first = WINDOW - 1; // first match index with a full window behind it
  const last = M - 1;
  // Nothing to draw until a full 8-match window exists.
  if (M < WINDOW || series.length === 0) return null;

  const stake = timeline.map((m) => m.maxPoints);

  const styleFor = (idx: number, isMe: boolean) => {
    if (isMe) return { stroke: GOLD, opacity: 1, width: 2.6, z: 2 };
    if (idx < 5) return { stroke: TOP5_COLORS[idx], opacity: 0.8, width: 1.6, z: 1 };
    return { stroke: GRAY, opacity: 0.2, width: 0.8, z: 0 };
  };

  // series is already sorted by total desc → same top 5 (and colours) as the
  // cumulative chart above.
  const lines = series.map((s, idx) => ({
    s,
    idx,
    ma: rollingRatio(s.cumulative, stake, WINDOW),
    st: styleFor(idx, s.userId === meId),
  }));

  const W = 320, H = 152, padL = 26, padR = 8, padT = 10, padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const span = last - first; // gaps between the plotted points
  const plotted = Array.from({ length: span + 1 }, (_, k) => first + k);
  const maxY = Math.max(0.01, ...lines.flatMap((l) => plotted.map((i) => l.ma[i])));
  const x = (i: number) => padL + (span <= 0 ? plotW / 2 : ((i - first) / span) * plotW);
  const y = (v: number) => padT + plotH - (v / maxY) * plotH;
  const band = span <= 0 ? plotW : plotW / span;

  const pathOf = (ma: number[]) => smoothPath(plotted.map((i) => ({ x: x(i), y: y(ma[i]) })));
  const drawOrder = [...lines].sort((a, b) => a.st.z - b.st.z);
  const legend = lines.filter((l) => l.idx < 5 || l.s.userId === meId);

  const step = Math.max(1, Math.ceil(plotted.length / 6));
  const xTicks = [...new Set(plotted.filter((_, k) => k % step === 0).concat(last))];
  const yTicks = [0, maxY / 2, maxY];

  const hv = hover !== null ? timeline[hover] : null;
  const hoverX = hover !== null ? x(hover) : 0;
  // Top 5 by aproveitamento AT the hovered match (a snapshot of who was in form).
  const rankedAtHover =
    hover !== null ? [...lines].sort((a, b) => b.ma[hover] - a.ma[hover]).slice(0, 5) : [];

  return (
    <div className="mb-6 rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-mute">Aproveitamento · últimos 8 jogos</span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label="Aproveitamento (últimos 8 jogos) de todos os jogadores"
          >
            {/* aproveitamento gridlines */}
            {yTicks.map((v) => (
              <g key={`y${v}`}>
                <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--line)" strokeWidth={0.5} opacity={0.6} />
                <text x={padL - 3} y={y(v) + 3} textAnchor="end" fontSize="7" fill="var(--mute)">{pct(v)}</text>
              </g>
            ))}

            {/* x-axis: match numbers */}
            {xTicks.map((i) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="7" fill="var(--mute)">
                {i + 1}
              </text>
            ))}

            {hv && (
              <line x1={hoverX} y1={padT} x2={hoverX} y2={padT + plotH} stroke="var(--mute)" strokeWidth={0.5} opacity={0.5} />
            )}

            {drawOrder.map(({ s, ma, st }) => (
              <g key={s.userId}>
                <path
                  d={pathOf(ma)}
                  fill="none"
                  stroke={st.stroke}
                  strokeWidth={st.width}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={st.opacity}
                />
                {st.z > 0 && hv && (
                  <circle cx={hoverX} cy={y(ma[hover as number])} r={1.8} fill={st.stroke} />
                )}
              </g>
            ))}

            {/* transparent hit areas — only over matches that have a full window */}
            {plotted.map((i) => (
              <rect
                key={i}
                x={x(i) - band / 2}
                y={padT}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>
          {hv && (
            <div
              className="pointer-events-none absolute top-1 z-10 w-44 -translate-x-1/2 rounded-md border border-line bg-panel2 px-2 py-1.5 text-[10px] shadow-lg shadow-black/50"
              style={{ left: `${Math.min(80, Math.max(20, (hoverX / W) * 100))}%` }}
            >
              <div className="font-semibold text-mute">
                Jogo {(hover as number) + 1} · {fmtDate(hv.ms)}
              </div>
              <div className="font-bold text-ink">
                {code(hv.homeTeam)} {hv.homeScore}–{hv.awayScore} {code(hv.awayTeam)}
              </div>
              <div className="mt-1 flex flex-col gap-0.5 border-t border-line pt-1">
                {rankedAtHover.map(({ s, ma, st }, rank) => (
                  <div key={s.userId} className="flex items-center gap-1.5">
                    <span className="tabular w-4 shrink-0 text-mute">{rank + 1}º</span>
                    <span
                      className="inline-block h-1.5 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: st.stroke }}
                    />
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {s.username === "Claude AI" ? "🤖 Claude AI" : s.username}
                    </span>
                    <span className="tabular shrink-0 text-mute">{pct(ma[hover as number])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 text-[11px] sm:w-44 sm:shrink-0">
          {legend.map(({ s, ma, st }) => (
            <span key={s.userId} className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: st.stroke }} />
              <span className={cn("truncate", s.userId === meId ? "font-bold text-ink" : "text-mute")}>
                {s.username === "Claude AI" ? "🤖 Claude AI" : s.username}
                {s.userId === meId ? " (você)" : ""} · {pct(ma[last])}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
