"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTeam } from "@/lib/teams";
import { HoverTip } from "@/components/hover-tip";
import { PointsChart } from "@/components/points-chart";
import type { LeaderRow, ScoredBet, PointsProgression } from "@/lib/db/queries";
import { computePayouts } from "@/lib/payout";

function flagOf(code: string | null): string {
  return getTeam(code)?.flag ?? "⚽";
}

// Hover breakdown: each match the player scored on — "🇧🇷 2 x 1 🇲🇦 +6pts".
function ScoredBetsList({ bets }: { bets: ScoredBet[] }) {
  return (
    <div className="flex max-h-[60vh] flex-col gap-1 text-left">
      {bets.map((bet, index) => (
        <div key={index} className="flex items-center justify-between gap-3 whitespace-nowrap">
          <span>
            {flagOf(bet.homeTeam)} {bet.homeScore} x {bet.awayScore} {flagOf(bet.awayTeam)}
          </span>
          <span className="font-bold text-neon">+{bet.points}pts</span>
        </div>
      ))}
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

type View = "official" | "live";

const brl = (cents: number) => `R$${(cents / 100).toFixed(0)}`;

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

  const N = sorted.length;
  const BAR = 16, barW = 10, padL = 24, padR = 6, padT = 12, plotH = 150, labelH = 86;
  const chartW = padL + N * BAR + padR;
  const chartH = padT + plotH + labelH;
  const xc = (i: number) => padL + i * BAR + BAR / 2;
  const yTop = (v: number) => padT + plotH - (v / maxV) * plotH;
  const yTicks = [0, Math.round(maxV / 2), maxV];
  const trunc = (s: string) => (s.length > 14 ? s.slice(0, 13) + "…" : s);
  const colorOf = (row: LeaderRow) =>
    row.userId === meId ? "var(--gold)" : rankOf(row) <= 3 ? "var(--neon)" : "var(--mute)";
  const opacityOf = (row: LeaderRow) =>
    row.userId === meId ? 1 : rankOf(row) <= 3 ? 0.9 : 0.35;

  return (
    <div className="mb-6 overflow-x-auto rounded-2xl border border-line bg-panel p-3">
      <svg width={chartW} height={chartH} className="block" role="img" aria-label="Pontos por jogador">
        <text x={2} y={padT - 4} fontSize="8" fill="var(--mute)">pts</text>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={padL} y1={yTop(v)} x2={chartW - padR} y2={yTop(v)} stroke="var(--line)" strokeWidth={0.5} opacity={0.6} />
            <text x={padL - 4} y={yTop(v) + 3} textAnchor="end" fontSize="8" fill="var(--mute)">{v}</text>
          </g>
        ))}
        {sorted.map((row, i) => {
          const cx = xc(i);
          const top = yTop(value(row));
          const labelY = padT + plotH + 6;
          const me = row.userId === meId;
          return (
            <g key={row.userId}>
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={padT + plotH - top}
                rx={1.5}
                fill={colorOf(row)}
                opacity={opacityOf(row)}
              />
              <text
                x={cx}
                y={labelY}
                transform={`rotate(-90 ${cx} ${labelY})`}
                textAnchor="end"
                fontSize="7"
                fill={me ? "var(--gold)" : "var(--ink)"}
                fontWeight={me ? "bold" : "normal"}
                opacity={me || rankOf(row) <= 3 ? 1 : 0.65}
              >
                {row.username === "Claude AI" ? "🤖 Claude AI" : trunc(row.username)}
              </text>
            </g>
          );
        })}
      </svg>
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
              const myScored = scoredBets[row.userId] ?? [];
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
                    <HoverTip
                      content={myScored.length > 0 ? <ScoredBetsList bets={myScored} /> : undefined}
                      className={cn(myScored.length > 0 && "cursor-help")}
                    >
                      <span className={nameColor}>
                        {row.username === "Claude AI" ? (
                          <>
                            🤖 <span className="font-mono">{row.username}</span>
                          </>
                        ) : (
                          row.username
                        )}
                      </span>
                    </HoverTip>
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
    </div>
  );
}
