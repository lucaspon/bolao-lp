"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LeaderRow } from "@/lib/db/queries";

const MEDALS = ["🥇", "🥈", "🥉"];

type View = "official" | "live";

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
            {row.username}
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
}: {
  rows: LeaderRow[];
  meId: number;
  concluded: number;
  liveCount: number;
}) {
  const hasLive = liveCount > 0;
  const [view, setView] = useState<View>(hasLive ? "live" : "official");

  const value = (row: LeaderRow) => (view === "live" ? row.livePoints : row.points);
  const sorted = [...rows].sort(
    (a, b) => value(b) - value(a) || b.exact - a.exact || a.username.localeCompare(b.username),
  );
  const top = sorted.filter((row) => value(row) > 0).slice(0, 3);

  const maxPoints = concluded * 3;
  const pct = (points: number) =>
    maxPoints > 0 ? `${Math.round((points / maxPoints) * 100)}%` : "–";

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-wide">Leaderboard</h1>
        {hasLive && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-md bg-danger/15 px-2 py-1 text-xs font-bold text-danger">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
              {liveCount} live
            </span>
            <div className="flex rounded-lg border border-line p-0.5 text-xs font-semibold">
              {(["live", "official"] as View[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  className={cn(
                    "rounded-md px-2.5 py-1 capitalize transition",
                    view === option ? "bg-panel2 text-ink" : "text-mute hover:text-ink",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {view === "live" && (
        <p className="mb-4 text-xs text-mute">
          Provisional standings — includes in-play matches at their current score. Not final.
        </p>
      )}

      {top.length > 0 ? (
        <Podium top={top} meId={meId} metric={view} />
      ) : (
        <p className="mb-6 rounded-xl border border-line bg-panel p-4 text-sm text-mute">
          No points yet — standings light up once matches are played.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-mute">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">Player</th>
              <th className="px-3 py-2.5 text-right font-semibold">Exact</th>
              <th className="px-3 py-2.5 text-right font-semibold">Winner</th>
              <th className="px-3 py-2.5 text-right font-semibold">Picks</th>
              <th className="px-3 py-2.5 text-right font-semibold">Pts</th>
              <th className="px-3 py-2.5 text-right font-semibold">Pts %</th>
              {hasLive && (
                <th className="px-3 py-2.5 text-right font-semibold text-danger">Live</th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, index) => {
              const isMe = row.userId === meId;
              return (
                <tr
                  key={row.userId}
                  className={cn(
                    "border-t border-line",
                    isMe ? "bg-neon/10" : index % 2 ? "bg-panel/40" : "",
                  )}
                >
                  <td className="tabular px-3 py-2.5 text-mute">{index + 1}</td>
                  <td className="px-3 py-2.5 font-medium">
                    <span className={isMe ? "text-neon" : "text-ink"}>{row.username}</span>
                    {isMe && <span className="ml-1.5 text-xs text-mute">(you)</span>}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right text-mute">{row.exact}</td>
                  <td className="tabular px-3 py-2.5 text-right text-mute">{row.correct}</td>
                  <td className="tabular px-3 py-2.5 text-right text-mute">{row.picks}</td>
                  <td
                    className={cn(
                      "tabular px-3 py-2.5 text-right font-display text-lg font-bold",
                      view === "official" ? "text-ink" : "text-mute",
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
