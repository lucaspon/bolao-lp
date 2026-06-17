import type { PointsProgression } from "@/lib/db/queries";

// 10 distinct line colours.
const PALETTE = [
  "#34e27a", "#ffd24a", "#5b9dff", "#ff5d6c", "#c084fc",
  "#22d3ee", "#fb923c", "#f472b6", "#a3e635", "#cbd5e1",
];

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

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
// finished-match timeline. Rank 1 sits at the top; lines are smoothed.
export function PointsChart({
  progression,
  meId,
}: {
  progression: PointsProgression;
  meId: number;
}) {
  const { timeline, series } = progression;
  if (timeline.length === 0 || series.length === 0) return null;

  const W = 320, H = 150, padL = 20, padR = 8, padT = 10, padB = 16;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = timeline.length;
  const maxRank = Math.max(2, ...series.flatMap((s) => s.positions));
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (rank: number) => padT + ((rank - 1) / (maxRank - 1)) * plotH; // 1 → top
  const toPts = (positions: number[]) => positions.map((r, i) => ({ x: x(i), y: y(r) }));

  return (
    <div className="mb-4 rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 text-xs font-semibold text-mute">Posições do top 10</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução das posições do top 10">
        {/* top (1º) and bottom (last) guide lines */}
        <line x1={padL} y1={y(1)} x2={W - padR} y2={y(1)} stroke="var(--line)" strokeWidth={0.5} strokeDasharray="2 2" />
        <line x1={padL} y1={y(maxRank)} x2={W - padR} y2={y(maxRank)} stroke="var(--line)" strokeWidth={0.5} />
        <text x={padL - 3} y={y(1) + 3} textAnchor="end" fontSize="7" fill="var(--mute)">1º</text>
        <text x={padL - 3} y={y(maxRank) + 3} textAnchor="end" fontSize="7" fill="var(--mute)">{maxRank}º</text>
        <text x={padL} y={H - 4} fontSize="7" fill="var(--mute)">{fmtDate(timeline[0].ms)}</text>
        <text x={W - padR} y={H - 4} textAnchor="end" fontSize="7" fill="var(--mute)">
          {fmtDate(timeline[n - 1].ms)}
        </text>
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
                opacity={me ? 1 : 0.9}
              />
              <circle cx={last.x} cy={last.y} r={me ? 2.6 : 1.8} fill={color} />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
        {series.map((s, idx) => (
          <span key={s.userId} className="flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-3 rounded-full"
              style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
            />
            <span className={s.userId === meId ? "font-bold text-ink" : "text-mute"}>
              {s.username === "Claude AI" ? "🤖 Claude AI" : s.username}
              {s.userId === meId ? " (você)" : ""} · {s.finalPosition}º
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
