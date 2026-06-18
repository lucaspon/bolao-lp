"use client";

import { useState } from "react";
import { getTeam } from "@/lib/teams";
import { cn } from "@/lib/utils";
import type { PointsProgression, ProgressionSeries } from "@/lib/db/queries";

// Top-5 line colours (gold is reserved for the logged-in user).
const TOP5_COLORS = ["#34e27a", "#5b9dff", "#ff5d6c", "#c084fc", "#22d3ee"];
const GOLD = "#ffd24a";
const GRAY = "#8a92a8";

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

// Inline SVG line chart of every player's cumulative points over the
// finished-match timeline (x = match number, y = points). Top 5 are coloured at
// 80%, the rest gray at 20%, and the logged-in user gold at full opacity.
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

  const W = 320, H = 152, padL = 22, padR = 8, padT = 10, padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = timeline.length + 1; // +1 for the start-at-0 point
  const maxY = Math.max(1, ...series.map((s) => s.total));
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / maxY) * plotH;
  const band = n <= 1 ? plotW : plotW / (n - 1);

  // series is sorted by total desc → the first 5 are the top 5.
  const styleFor = (s: ProgressionSeries, idx: number) => {
    if (s.userId === meId) return { stroke: GOLD, opacity: 1, width: 2.6, z: 2 };
    if (idx < 5) return { stroke: TOP5_COLORS[idx], opacity: 0.8, width: 1.6, z: 1 };
    return { stroke: GRAY, opacity: 0.2, width: 0.8, z: 0 };
  };
  const pathOf = (s: ProgressionSeries) =>
    smoothPath([0, ...s.cumulative].map((v, i) => ({ x: x(i), y: y(v) })));
  // Draw gray first, then top-5, then the user on top.
  const drawOrder = series.map((s, idx) => ({ s, idx, st: styleFor(s, idx) })).sort((a, b) => a.st.z - b.st.z);
  const legend = series.map((s, idx) => ({ s, idx, st: styleFor(s, idx) })).filter((e) => e.idx < 5 || e.s.userId === meId);

  const step = Math.max(1, Math.ceil(timeline.length / 6));
  const xTicks = [...new Set([...Array(timeline.length).keys()].filter((i) => i % step === 0).concat(timeline.length - 1))];
  const yTicks = [0, Math.round(maxY / 2), maxY];

  const hv = hover != null ? timeline[hover] : null;

  return (
    <div className="mb-6 rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 text-xs font-semibold text-mute">Pontos acumulados</div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:flex-1">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Pontos acumulados de todos os jogadores">
            {/* points gridlines */}
            {yTicks.map((v) => (
              <g key={`y${v}`}>
                <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--line)" strokeWidth={0.5} opacity={0.6} />
                <text x={padL - 3} y={y(v) + 3} textAnchor="end" fontSize="7" fill="var(--mute)">{v}</text>
              </g>
            ))}

            {/* x-axis: match numbers */}
            {xTicks.map((i) => (
              <text key={i} x={x(i + 1)} y={H - 6} textAnchor="middle" fontSize="7" fill="var(--mute)">
                {i + 1}
              </text>
            ))}

            {hv && <line x1={x(hover! + 1)} y1={padT} x2={x(hover! + 1)} y2={padT + plotH} stroke="var(--mute)" strokeWidth={0.5} opacity={0.5} />}

            {drawOrder.map(({ s, st }) => {
              const colored = st.z > 0;
              return (
                <g key={s.userId}>
                  <path
                    d={pathOf(s)}
                    fill="none"
                    stroke={st.stroke}
                    strokeWidth={st.width}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={st.opacity}
                  />
                  {colored && hv && (
                    <circle cx={x(hover! + 1)} cy={y(s.cumulative[hover!])} r={1.8} fill={st.stroke} />
                  )}
                </g>
              );
            })}

            {/* transparent hit areas, one per match */}
            {timeline.map((_, i) => (
              <rect
                key={i}
                x={x(i + 1) - band / 2}
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
              style={{ left: `${Math.min(82, Math.max(18, (x(hover! + 1) / W) * 100))}%` }}
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
          {legend.map(({ s, st }) => (
            <span key={s.userId} className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: st.stroke }} />
              <span className={cn("truncate", s.userId === meId ? "font-bold text-ink" : "text-mute")}>
                {s.username === "Claude AI" ? "🤖 Claude AI" : s.username}
                {s.userId === meId ? " (você)" : ""} · {s.total}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
