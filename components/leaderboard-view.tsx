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

function Podium({
  top,
  meId,
  metric,
}: {
  top: LeaderRow[];
  meId: number;
  metric: View;
}) {
  const value = (row: LeaderRow) => (metric === "live" ? row.livePoints : row.points);
  const ranked = top.map((row, index) => ({ row, place: index + 1 }));
  const order = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
  const heights: Record<number, number> = { 1: 116, 2: 88, 3: 70 };

  return (
    <div className="mb-8 flex items-end justify-center gap-3">
      {order.map(({ row, place }) => (
        <div key={row.userId} className="flex w-24 flex-col items-center">
          <div className="mb-1 text-2xl">{MEDALS[place - 1]}</div>
          <div
            className={cn(
              "truncate text-sm font-semibold",
              row.userId === meId ? "text-neon" : "text-ink",
            )}
          >
            {row.username === "Claude AI" ? (
              <>🤖 <span className="font-mono">{row.username}</span></>
            ) : row.username}
          </div>
          <div
            className={cn(
              "tabular mb-2 font-display text-lg font-bold",
              metric === "live" ? "text-danger" : "text-gold",
            )}
          >
            {value(row)}
          </div>
          <div
            className="flex w-full items-center justify-center rounded-t-lg border border-line bg-panel font-display text-2xl font-bold text-mute"
            style={{ height: heights[place] }}
          >
            {place}
          </div>
        </div>
      ))}
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
  const top = sorted.filter((row) => value(row) > 0).slice(0, 3);

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

      <PointsChart progression={progression} meId={meId} />

      {top.length > 0 ? (
        <Podium top={top} meId={meId} metric={view} />
      ) : (
        <p className="mb-6 rounded-xl border border-line bg-panel p-4 text-sm text-mute">
          Sem pontos ainda — a classificação ganha vida quando os jogos começam.
        </p>
      )}

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
                          title={`${delta > 0 ? "subiu" : "caiu"} ${Math.abs(delta)} ${
                            Math.abs(delta) === 1 ? "posição" : "posições"
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
