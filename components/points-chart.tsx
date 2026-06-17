import type { PointsProgression } from "@/lib/db/queries";

// 10 distinct line colours.
const PALETTE = [
  "#34e27a", "#ffd24a", "#5b9dff", "#ff5d6c", "#c084fc",
  "#22d3ee", "#fb923c", "#f472b6", "#a3e635", "#cbd5e1",
];

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

// Inline SVG multi-line chart: cumulative points of the top 10 over the
// finished-match timeline. Lines start at 0 (before the first match).
export function PointsChart({
  progression,
  meId,
}: {
  progression: PointsProgression;
  meId: number;
}) {
  const { timeline, series } = progression;
  if (timeline.length === 0 || series.length === 0) return null;

  const W = 320, H = 150, padL = 22, padR = 8, padT = 10, padB = 16;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = timeline.length + 1; // +1 for the start-at-0 point
  const maxY = Math.max(1, ...series.map((s) => s.total));
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / maxY) * plotH;
  const path = (s: ProgressionPoints) =>
    [0, ...s].map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <div className="mb-4 rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 text-xs font-semibold text-mute">Evolução do top 10</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução dos pontos do top 10">
        {/* baseline + max gridlines */}
        <line x1={padL} y1={y(0)} x2={W - padR} y2={y(0)} stroke="var(--line)" strokeWidth={0.5} />
        <line
          x1={padL} y1={y(maxY)} x2={W - padR} y2={y(maxY)}
          stroke="var(--line)" strokeWidth={0.5} strokeDasharray="2 2"
        />
        <text x={padL - 3} y={y(0) + 3} textAnchor="end" fontSize="7" fill="var(--mute)">0</text>
        <text x={padL - 3} y={y(maxY) + 3} textAnchor="end" fontSize="7" fill="var(--mute)">{maxY}</text>
        {/* x range */}
        <text x={padL} y={H - 4} fontSize="7" fill="var(--mute)">{fmtDate(timeline[0].ms)}</text>
        <text x={W - padR} y={H - 4} textAnchor="end" fontSize="7" fill="var(--mute)">
          {fmtDate(timeline[timeline.length - 1].ms)}
        </text>
        {/* one polyline per player (leader drawn last = on top) */}
        {series.map((s, idx) => (
          <polyline
            key={s.userId}
            points={path(s.cumulative)}
            fill="none"
            stroke={PALETTE[idx % PALETTE.length]}
            strokeWidth={s.userId === meId ? 2.4 : 1.3}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={s.userId === meId ? 1 : 0.9}
          />
        ))}
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
              {s.userId === meId ? " (você)" : ""} · {s.total}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

type ProgressionPoints = number[];
