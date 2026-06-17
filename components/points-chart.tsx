"use client";

import { useState } from "react";
import { getTeam } from "@/lib/teams";
import { cn } from "@/lib/utils";
import type { PointsProgression } from "@/lib/db/queries";

// 10 distinct line colours.
const PALETTE = [
  "#34e27a", "#ffd24a", "#5b9dff", "#ff5d6c", "#c084fc",
  "#22d3ee", "#fb923c", "#f472b6", "#a3e635", "#cbd5e1",
];

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const code = (c: string | null) => getTeam(c)?.code ?? c ?? "?";

type Pt = { x: number; y: number };

// Catmull-Rom → cubic-bezier, for smooth lines through every point.
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Inline SVG "bump chart": each top-10 player's leaderboard position over the
// finished-match timeline (x = match number). Rank 1 sits at the top; lines are
// smoothed; hovering a match shows its result.
export function PointsChart({
  progression,
  meId,
}: {
  progression: PointsProgression;
  meId: number;
}) {
  const { timeline, series } = progression;
  const [hover, setHover] = useState<number | null>(null);
  if (timeline.length === 0 || series.length === 0) return null;

  const W = 320, H = 152, padL = 20, padR = 8, padT = 10, padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = timeline.length;
  const lastRank = Math.max(2, progression.playerCount); // axis spans 1º → last place
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (rank: number) => padT + ((rank - 1) / (lastRank - 1)) * plotH; // 1 → top
  const toPts = (positions: number[]) => positions.map((r, i) => ({ x: x(i), y: y(r) }));
  const band = n <= 1 ? plotW : plotW / (n - 1);

  // ~6 evenly-spaced match-number ticks, always including the first and last.
  const step = Math.max(1, Math.ceil(n / 6));
  const xTicks = [...new Set([...Array(n).keys()].filter((i) => i % step === 0).concat(n - 1))];
  // Position gridlines every 5 (1, 5, 10, …) plus the last place.
  const yTicks = [...new Set([1, ...Array.from({ length: lastRank }, (_, i) => i + 1).filter((r) => r % 5 === 0), lastRank])];

  const hv = hover != null ? timeline[hover] : null;

  return (
    <div className="mb-6 rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 text-xs font-semibold text-mute">Posições do top 10</div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative w-full sm:flex-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução das posições do top 10">
        {/* position gridlines every 5 (1º → last) */}
        {yTicks.map((r) => (
          <g key={`y${r}`}>
            <line x1={padL} y1={y(r)} x2={W - padR} y2={y(r)} stroke="var(--line)" strokeWidth={0.5} strokeDasharray={r === 1 ? "2 2" : undefined} opacity={0.6} />
            <text x={padL - 3} y={y(r) + 3} textAnchor="end" fontSize="7" fill="var(--mute)">{r}º</text>
          </g>
        ))}

        {/* x-axis: match numbers */}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="7" fill="var(--mute)">
            {i + 1}
          </text>
        ))}

        {/* hovered match: guide line */}
        {hv && <line x1={x(hover!)} y1={padT} x2={x(hover!)} y2={padT + plotH} stroke="var(--mute)" strokeWidth={0.5} opacity={0.5} />}

        {series.map((s, idx) => {
          const pts = toPts(s.positions);
          const last = pts[pts.length - 1];
          const color = PALETTE[idx % PALETTE.length];
          const me = s.userId === meId;
          return (
            <g key={s.userId}>
              <path
                d={smoothPath(pts)}
                fill="none"
                stroke={color}
                strokeWidth={me ? 2.4 : 1.3}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.75}
              />
              <circle cx={last.x} cy={last.y} r={me ? 2.6 : 1.8} fill={color} opacity={0.75} />
              {hv && <circle cx={x(hover!)} cy={y(s.positions[hover!])} r={1.8} fill={color} />}
            </g>
          );
        })}

        {/* transparent hit areas, one per match */}
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
            style={{ left: `${Math.min(82, Math.max(18, (x(hover!) / W) * 100))}%` }}
          >
            <div className="font-semibold text-mute">
              Jogo {hover! + 1} · {fmtDate(hv.ms)}
            </div>
            <div className="font-bold text-ink">
              {code(hv.homeTeam)} {hv.homeScore}–{hv.awayScore} {code(hv.awayTeam)}
            </div>
            <div className="mt-1 flex flex-col gap-0.5 border-t border-line pt-1">
              {hv.top5.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="tabular w-4 shrink-0 text-mute">{s.position}º</span>
                  <span className="truncate text-ink">
                    {s.username === "Claude AI" ? "🤖 Claude AI" : s.username}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 text-[11px] sm:w-44 sm:shrink-0">
        {series.map((s, idx) => (
          <span key={s.userId} className="flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
            />
            <span className="shrink-0 tabular text-mute">{s.finalPosition}º</span>
            <span className={cn("truncate", s.userId === meId ? "font-bold text-ink" : "text-mute")}>
              {s.username === "Claude AI" ? "🤖 Claude AI" : s.username}
              {s.userId === meId ? " (você)" : ""}
            </span>
          </span>
        ))}
      </div>
      </div>
    </div>
  );
}
