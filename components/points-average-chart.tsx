"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PointsProgression } from "@/lib/db/queries";
import { TOP5_COLORS, GOLD, GRAY, fmtDate, code, smoothPath } from "@/components/points-chart";

const WINDOW = 8;

// Trailing average of points-per-match over the last `window` finished matches.
// Derived from the cumulative series (per-match points = consecutive diffs), so
// no extra query is needed. Early matches average over however many exist.
function movingAverage(cumulative: number[], window: number): number[] {
  const perMatch = cumulative.map((value, i) => value - (i > 0 ? cumulative[i - 1] : 0));
  return perMatch.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    let sum = 0;
    for (let j = start; j <= i; j++) sum += perMatch[j];
    return sum / (i - start + 1);
  });
}

const fmtY = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// Inline SVG line chart mirroring PointsChart's formatting, but plotting each
// player's 8-match moving average of points (their recent "form") over the
// finished-match timeline. Same top-5 colouring, gold for the logged-in user.
export function PointsAverageChart({
  progression,
  meId,
}: {
  progression: PointsProgression;
  meId: number;
}) {
  const { timeline, series } = progression;
  const [hover, setHover] = useState<number | null>(null);
  if (timeline.length === 0 || series.length === 0) return null;

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
    ma: movingAverage(s.cumulative, WINDOW),
    st: styleFor(idx, s.userId === meId),
  }));

  const W = 320, H = 152, padL = 22, padR = 8, padT = 10, padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const M = timeline.length;
  const maxY = Math.max(1, ...lines.flatMap((l) => l.ma));
  const x = (i: number) => padL + (M <= 1 ? plotW / 2 : (i / (M - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / maxY) * plotH;
  const band = M <= 1 ? plotW : plotW / (M - 1);

  const pathOf = (ma: number[]) => smoothPath(ma.map((v, i) => ({ x: x(i), y: y(v) })));
  const drawOrder = [...lines].sort((a, b) => a.st.z - b.st.z);
  const legend = lines.filter((l) => l.idx < 5 || l.s.userId === meId);
  const top5 = lines.slice(0, 5);

  const step = Math.max(1, Math.ceil(M / 6));
  const xTicks = [...new Set([...Array(M).keys()].filter((i) => i % step === 0).concat(M - 1))];
  const yTicks = [0, maxY / 2, maxY];

  const hv = hover !== null ? timeline[hover] : null;
  const hoverX = hover !== null ? x(hover) : 0;

  return (
    <div className="mb-6 rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-mute">Média de pontos · últimos 8 jogos</span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label="Média móvel de pontos (8 jogos) de todos os jogadores"
          >
            {/* points gridlines */}
            {yTicks.map((v) => (
              <g key={`y${v}`}>
                <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--line)" strokeWidth={0.5} opacity={0.6} />
                <text x={padL - 3} y={y(v) + 3} textAnchor="end" fontSize="7" fill="var(--mute)">{fmtY(v)}</text>
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

            {/* transparent hit areas */}
            {timeline.map((_, i) => (
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
              className="pointer-events-none absolute top-1 z-10 w-40 -translate-x-1/2 rounded-md border border-line bg-panel2 px-2 py-1.5 text-[10px] shadow-lg shadow-black/50"
              style={{ left: `${Math.min(82, Math.max(18, (hoverX / W) * 100))}%` }}
            >
              <div className="font-semibold text-mute">
                Jogo {(hover as number) + 1} · {fmtDate(hv.ms)}
              </div>
              <div className="font-bold text-ink">
                {code(hv.homeTeam)} {hv.homeScore}–{hv.awayScore} {code(hv.awayTeam)}
              </div>
              <div className="mt-1 flex flex-col gap-0.5 border-t border-line pt-1">
                {top5.map(({ s, ma, st }) => (
                  <div key={s.userId} className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: st.stroke }} />
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {s.username === "Claude AI" ? "🤖 Claude AI" : s.username}
                    </span>
                    <span className="tabular shrink-0 text-mute">{ma[hover as number].toFixed(1)}</span>
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
                {s.userId === meId ? " (você)" : ""} · {ma[ma.length - 1].toFixed(1)}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
