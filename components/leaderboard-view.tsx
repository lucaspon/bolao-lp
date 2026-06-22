"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { PlayerResultsModal } from "@/components/player-results-modal";
import { PointsChart } from "@/components/points-chart";
import type { LeaderRow, ScoredBet, PointsProgression } from "@/lib/db/queries";
import { computePayouts } from "@/lib/payout";

const MEDALS = ["🥇", "🥈", "🥉"];

type View = "official" | "live";

const brl = (cents: number) => `R$${(cents / 100).toFixed(0)}`;

// Theme colours as hex (recharts sets SVG fill attributes, which don't resolve
// CSS var()).
const C = { gold: "#ffd24a", green: "#34e27a", gray: "#8a92a8", line: "#242a3b", panel2: "#171b29", ink: "#e9ecf5" };

function trunc(s: string) {
  return s.length > 16 ? s.slice(0, 15) + "…" : s;
}

// Rotated x-axis label, gold + bold for the logged-in user.
function UserTick(props: { x?: number; y?: number; payload?: { value: string }; meName?: string }) {
  const { x = 0, y = 0, payload, meName } = props;
  const name = payload?.value ?? "";
  const me = name === meName;
  return (
    <text
      x={x}
      y={y}
      dy={3}
      textAnchor="end"
      transform={`rotate(-90, ${x}, ${y})`}
      fontSize={9}
      fill={me ? C.gold : C.gray}
      fontWeight={me ? 700 : 400}
    >
      {trunc(name)}
    </text>
  );
}

// Current points of every player as vertical bars (y = points, x = usernames
// rotated 90°). Top 3 green, the logged-in user gold, everyone else gray.
function PointsBarChart({
  rows,
  meId,
  metric,
}: {
  rows: LeaderRow[];
  meId: number;
  metric: "livePoints" | "points";
}) {
  const value = (row: LeaderRow) => row[metric];
  const sorted = [...rows].sort(
    (a, b) => value(b) - value(a) || a.username.localeCompare(b.username),
  );
  const maxV = Math.max(0, ...sorted.map(value));
  if (maxV <= 0) {
    return (
      <p className="mb-6 rounded-xl border border-line bg-panel p-4 text-sm text-mute">
        Sem pontos ainda — a classificação ganha vida quando os jogos começam.
      </p>
    );
  }
  const rankOf = (row: LeaderRow) => 1 + sorted.filter((r) => value(r) > value(row)).length;
  const meName = rows.find((r) => r.userId === meId)?.username;
  const display = (name: string) => (name === "Claude AI" ? "🤖 Claude AI" : name);

  const data = sorted.map((row) => {
    const me = row.userId === meId;
    const top3 = rankOf(row) <= 3;
    return {
      name: display(row.username),
      value: value(row),
      fill: me ? C.gold : top3 ? C.green : C.gray,
      opacity: me ? 1 : top3 ? 0.9 : 0.4,
    };
  });
  const meDisplay = meName ? display(meName) : undefined;

  return (
    <div className="mb-6 rounded-2xl border border-line bg-panel p-3">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: -8 }}>
          <YAxis
            allowDecimals={false}
            width={34}
            tick={{ fontSize: 10, fill: C.gray }}
            axisLine={false}
            tickLine={false}
          />
          <XAxis
            dataKey="name"
            interval={0}
            height={84}
            tickLine={false}
            axisLine={{ stroke: C.line }}
            tick={<UserTick meName={meDisplay} />}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            contentStyle={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: C.ink }}
            itemStyle={{ color: C.ink }}
            formatter={(v) => [v, "pts"]}
          />
          <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} fillOpacity={d.opacity} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LeaderboardView({
  rows,
  meId,
  concluded,
  liveCount,
  potCents,
  scoredBets,
  progression,
}: {
  rows: LeaderRow[];
  meId: number;
  concluded: number;
  liveCount: number;
  potCents: number;
  scoredBets: Record<number, ScoredBet[]>;
  progression: PointsProgression;
}) {
  const hasLive = liveCount > 0;
  const [view, setView] = useState<View>("live"); // Prévia is the default view
  const [openUserId, setOpenUserId] = useState<number | null>(null);

  const metric = view === "live" ? "livePoints" : "points";
  const value = (row: LeaderRow) => row[metric];
  const sorted = [...rows].sort(
    (a, b) =>
      value(b) - value(a) ||
      b.stakeCents - a.stakeCents || // ties broken by total bet, highest first
      b.exact - a.exact ||
      a.username.localeCompare(b.username),
  );

  // Competition rank: 1 + how many score strictly higher. A player qualifies (and
  // goes gold) when their rank is ≤ 3 — so literal ties at the boundary widen the
  // golden pool exactly like the payout does (1,2,3,3 → four winners).
  const rankOf = (row: LeaderRow) => 1 + sorted.filter((r) => value(r) > value(row)).length;
  const qualifies = (row: LeaderRow) => value(row) > 0 && rankOf(row) <= 3;

  // In the Prévia view, how the in-play games shift a player vs the official
  // standing: positive = climbing (better live rank than official), negative =
  // dropping. Competition rank by each metric, independent of the current sort.
  const rankByMetric = (row: LeaderRow, m: "livePoints" | "points") =>
    1 + rows.filter((r) => r[m] > row[m]).length;
  const liveDelta = (row: LeaderRow) =>
    rankByMetric(row, "points") - rankByMetric(row, "livePoints");

  const payouts = computePayouts(rows, potCents, metric);

  const maxPoints = concluded * 3;
  const pct = (points: number) =>
    maxPoints > 0 ? `${Math.round((points / maxPoints) * 100)}%` : "–";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">Classificação</h1>
          {potCents > 0 && (
            <p className="text-sm text-mute">
              Pote: <span className="font-semibold text-gold">{brl(potCents)}</span> · top 3 levam
              (empates expandem o pódio), proporcional a pontos × aposta
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasLive && (
            <span className="flex items-center gap-1.5 rounded-md bg-danger/15 px-2 py-1 text-xs font-bold text-danger">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
              {liveCount} ao vivo
            </span>
          )}
          <div className="flex rounded-lg border border-line p-0.5 text-xs font-semibold">
            {(["live", "official"] as View[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={cn(
                  "rounded-md px-2.5 py-1 transition",
                  view === option ? "bg-panel2 text-ink" : "text-mute hover:text-ink",
                )}
              >
                {option === "live" ? "Prévia" : "Oficial"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "live" && (
        <p className="mb-4 text-xs text-mute">
          Prévia — conta os jogos em andamento pelo placar atual. Não é a classificação final.
        </p>
      )}

      <PointsBarChart rows={rows} meId={meId} metric={metric} />

      <PointsChart progression={progression} meId={meId} />

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-mute">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">Jogador</th>
              <th className="px-3 py-2.5 text-right font-semibold">Cravadas</th>
              <th className="px-3 py-2.5 text-right font-semibold">Resultado</th>
              <th className="px-3 py-2.5 text-right font-semibold">Pts</th>
              <th className="px-3 py-2.5 text-right font-semibold">Pts %</th>
              {hasLive && (
                <th className="px-3 py-2.5 text-right font-semibold text-danger">Ao vivo</th>
              )}
              <th className="px-3 py-2.5 text-right font-semibold">Aposta</th>
              <th className="px-3 py-2.5 text-right font-semibold text-gold">Prêmio</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => {
              const isMe = row.userId === meId;
              const gold = qualifies(row);
              const rank = rankOf(row);
              const nameColor = isMe ? "text-neon" : gold ? "text-gold" : "text-ink";
              const delta = view === "live" && hasLive ? liveDelta(row) : 0;
              return (
                <tr
                  key={row.userId}
                  className={cn(
                    "border-t border-line",
                    gold
                      ? "bg-gold/10"
                      : isMe
                        ? "bg-neon/10"
                        : index % 2
                          ? "bg-panel/40"
                          : "",
                  )}
                >
                  <td className="tabular px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      {gold ? (
                        <span className="text-base">{MEDALS[rank - 1]}</span>
                      ) : (
                        <span className="text-mute">{index + 1}</span>
                      )}
                      {delta !== 0 && (
                        <span
                          className={cn(
                            "flex items-center text-[10px] font-bold",
                            delta > 0 ? "text-neon" : "text-danger",
                          )}
                          title={`${delta > 0 ? "subiu" : "caiu"} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? "posição" : "posições"
                            } na prévia`}
                        >
                          {delta > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                          {Math.abs(delta) > 1 && Math.abs(delta)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    <button
                      type="button"
                      onClick={() => setOpenUserId(row.userId)}
                      className={cn(nameColor, "cursor-pointer text-left hover:underline")}
                    >
                      {row.username === "Claude AI" ? (
                        <>
                          🤖 <span className="font-mono">{row.username}</span>
                        </>
                      ) : (
                        row.username
                      )}
                    </button>
                    {isMe && <span className="ml-1.5 text-xs text-mute">(você)</span>}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right text-mute">{row.exact}</td>
                  <td className="tabular px-3 py-2.5 text-right text-mute">{row.correct}</td>
                  <td
                    className={cn(
                      "tabular px-3 py-2.5 text-right font-display text-lg font-bold",
                      gold ? "text-gold" : view === "official" ? "text-ink" : "text-mute",
                    )}
                  >
                    {row.points}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right text-mute">{pct(row.points)}</td>
                  {hasLive && (
                    <td
                      className={cn(
                        "tabular px-3 py-2.5 text-right font-display text-lg font-bold",
                        view === "live" ? "text-danger" : "text-mute",
                      )}
                    >
                      {row.livePoints}
                    </td>
                  )}
                  <td className="tabular px-3 py-2.5 text-right text-mute">
                    {row.stakeCents > 0 ? (
                      <>
                        {brl(row.stakeCents)}
                        {row.stakeW1Cents < row.stakeCents && (
                          <span className="block text-[10px] text-mute/70">
                            pré {brl(row.stakeW1Cents)}
                          </span>
                        )}
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right font-display text-base font-bold text-gold">
                    {payouts.get(row.userId) ? brl(payouts.get(row.userId)!) : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openUserId !== null &&
        (() => {
          const row = sorted.find((r) => r.userId === openUserId);
          if (!row) return null;
          return (
            <PlayerResultsModal
              row={row}
              rank={rankOf(row)}
              bets={scoredBets[row.userId] ?? []}
              prizeCents={payouts.get(row.userId) ?? 0}
              pct={pct(row.points)}
              isMe={row.userId === meId}
              hasLive={hasLive}
              onClose={() => setOpenUserId(null)}
            />
          );
        })()}
    </div>
  );
}
