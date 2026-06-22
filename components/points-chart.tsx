"use client";

import { useState } from "react";
import { getTeam } from "@/lib/teams";
import { cn } from "@/lib/utils";
import type { PointsProgression, ProgressionSeries, LeaderRow } from "@/lib/db/queries";

// Top-5 line colours (gold is reserved for the logged-in user).
const TOP5_COLORS = ["#34e27a", "#5b9dff", "#ff5d6c", "#c084fc", "#22d3ee"];
const GOLD = "#ffd24a";
const GRAY = "#8a92a8";

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const code = (c: string | null) => getTeam(c)?.code ?? c ?? "?";

type Pt = { x: number; y: number };

// Monotone cubic interpolation (Fritsch–Carlson, à la d3 curveMonotoneX): smooth
// but never overshoots the data points — so monotonic data (cumulative points)
// stays monotonic, instead of the Catmull-Rom dips between flat-then-jump points.
function smoothPath(pts: Pt[]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  if (n === 2) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;

  const h: number[] = [];
  const s: number[] = []; // secant slopes
  for (let i = 0; i < n - 1; i++) {
    h[i] = pts[i + 1].x - pts[i].x;
    s[i] = (pts[i + 1].y - pts[i].y) / h[i];
  }
  // tangents: 0 at extrema/flats, weighted harmonic mean otherwise (monotone-safe)
  const m: number[] = new Array(n);
  m[0] = s[0];
  m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1] * s[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i]);
    }
  }

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + h[i] / 3;
    const c1y = pts[i].y + (m[i] * h[i]) / 3;
    const c2x = pts[i + 1].x - h[i] / 3;
    const c2y = pts[i + 1].y - (m[i + 1] * h[i]) / 3;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${pts[i + 1].x.toFixed(1)} ${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

// Inline SVG line chart of every player's cumulative points over the
// finished-match timeline (x = match number, y = points). Top 5 are coloured at
// 80%, the rest gray at 20%, and the logged-in user gold at full opacity. When
// games are in progress, each line gets a DASHED extension to the player's
// Prévia total (official + current in-play points).
export function PointsChart({
  progression,
  meId,
  rows,
}: {
  progression: PointsProgression;
  meId: number;
  rows: LeaderRow[];
}) {
  const { timeline, series } = progression;
  const [hover, setHover] = useState<number | "live" | null>(null);
  if (timeline.length === 0 || series.length === 0) return null;

  const liveByUser = new Map(rows.map((r) => [r.userId, r.livePoints]));
  const liveOf = (s: ProgressionSeries) => liveByUser.get(s.userId) ?? s.total;
  const hasLive = series.some((s) => liveOf(s) > s.total);

  const W = 320, H = 152, padL = 22, padR = 8, padT = 10, padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const M = timeline.length;
  const liveIdx = M + 1; // x-index of the trailing "ao vivo" slot
  const slots = M + 1 + (hasLive ? 1 : 0); // start(0) + matches + maybe live
  const maxY = Math.max(1, ...series.map((s) => Math.max(s.total, liveOf(s))));
  const x = (i: number) => padL + (slots <= 1 ? plotW / 2 : (i / (slots - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / maxY) * plotH;
  const band = slots <= 1 ? plotW : plotW / (slots - 1);

  // series is sorted by total desc → the first 5 are the top 5.
  const styleFor = (s: ProgressionSeries, idx: number) => {
    if (s.userId === meId) return { stroke: GOLD, opacity: 1, width: 2.6, z: 2 };
    if (idx < 5) return { stroke: TOP5_COLORS[idx], opacity: 0.8, width: 1.6, z: 1 };
    return { stroke: GRAY, opacity: 0.2, width: 0.8, z: 0 };
  };
  const pathOf = (s: ProgressionSeries) =>
    smoothPath([0, ...s.cumulative].map((v, i) => ({ x: x(i), y: y(v) })));
  const drawOrder = series.map((s, idx) => ({ s, idx, st: styleFor(s, idx) })).sort((a, b) => a.st.z - b.st.z);
  const legend = series.map((s, idx) => ({ s, idx, st: styleFor(s, idx) })).filter((e) => e.idx < 5 || e.s.userId === meId);

  const step = Math.max(1, Math.ceil(M / 6));
  const xTicks = [...new Set([...Array(M).keys()].filter((i) => i % step === 0).concat(M - 1))];
  const yTicks = [0, Math.round(maxY / 2), maxY];

  const hv = typeof hover === "number" ? timeline[hover] : null;
  const hoverX = hover === "live" ? x(liveIdx) : hv ? x((hover as number) + 1) : 0;

  return (
    <div className="mb-6 rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-mute">Pontos acumulados</span>
        {hasLive && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-gold">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" /> ao vivo
          </span>
        )}
      </div>
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

            {/* x-axis: match numbers + live slot */}
            {xTicks.map((i) => (
              <text key={i} x={x(i + 1)} y={H - 6} textAnchor="middle" fontSize="7" fill="var(--mute)">
                {i + 1}
              </text>
            ))}

            {(hv || hover === "live") && (
              <line x1={hoverX} y1={padT} x2={hoverX} y2={padT + plotH} stroke="var(--mute)" strokeWidth={0.5} opacity={0.5} />
            )}

            {drawOrder.map(({ s, st }) => {
              const live = liveOf(s);
              // Extend every line to the "ao vivo" slot — flat for +0 players.
              const showLive = hasLive;
              const hoverY =
                hover === "live" ? y(live) : hv ? y(s.cumulative[hover as number]) : 0;
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
                  {showLive && (
                    <line
                      x1={x(M)}
                      y1={y(s.total)}
                      x2={x(liveIdx)}
                      y2={y(live)}
                      stroke={st.stroke}
                      strokeWidth={st.width}
                      strokeLinecap="round"
                      opacity={st.opacity}
                    />
                  )}
                  {st.z > 0 && (hv || hover === "live") && (
                    <circle cx={hoverX} cy={hoverY} r={1.8} fill={st.stroke} />
                  )}
                </g>
              );
            })}

            {/* transparent hit areas */}
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
            {hasLive && (
              <rect
                x={x(liveIdx) - band / 2}
                y={padT}
                width={band}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover("live")}
                onMouseLeave={() => setHover(null)}
              />
            )}
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
          {hover === "live" && (
            <div
              className="pointer-events-none absolute top-1 z-10 w-40 -translate-x-1/2 rounded-md border border-line bg-panel2 px-2 py-1.5 text-[10px] shadow-lg shadow-black/50"
              style={{ left: `${Math.min(82, Math.max(18, (hoverX / W) * 100))}%` }}
            >
              <div className="font-bold text-gold">Prévia · ao vivo</div>
              <div className="text-mute">
                Projeção pelo placar atual dos jogos em andamento.
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 text-[11px] sm:w-44 sm:shrink-0">
          {legend.map(({ s, st }) => {
            const live = liveOf(s);
            return (
              <span key={s.userId} className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: st.stroke }} />
                <span className={cn("truncate", s.userId === meId ? "font-bold text-ink" : "text-mute")}>
                  {s.username === "Claude AI" ? "🤖 Claude AI" : s.username}
                  {s.userId === meId ? " (você)" : ""} · {s.total}
                  {live > s.total && <span className="text-gold"> →{live}</span>}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
