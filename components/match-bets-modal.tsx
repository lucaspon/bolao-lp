"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getTeam } from "@/lib/teams";
import { scoreBet } from "@/lib/scoring";
import { getMatchBetsAction } from "@/app/actions/bets";
import type { MatchBet } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

function TeamLabel({ code }: { code: string | null }) {
  const team = getTeam(code);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-sm leading-none">{team ? team.flag : "⚽"}</span>
      <span className="font-display font-semibold text-ink">{team ? team.code : "TBD"}</span>
    </span>
  );
}

type Row = MatchBet & { base: number; points: number };

// All players' predictions for one (closed) fixture, scored against its result.
export function MatchBetsModal({
  matchId,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  multiplier,
  live,
  meId,
  onClose,
}: {
  matchId: number;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  multiplier: number;
  live: boolean;
  meId: number;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    getMatchBetsAction(matchId).then((res) => {
      if (!active) return;
      if (!res.ok || !res.bets) {
        setError(res.error ?? "Não foi possível carregar os palpites.");
        return;
      }
      const scored: Row[] = res.bets.map((bet) => {
        const base = scoreBet(bet.homePred, bet.awayPred, homeScore, awayScore);
        return { ...bet, base, points: base * multiplier };
      });
      scored.sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));
      setRows(scored);
    });
    return () => {
      active = false;
    };
  }, [matchId, homeScore, awayScore, multiplier]);

  const tone = (base: number) =>
    base === 3 ? "text-neon" : base === 1 ? "text-gold" : "text-mute";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-line bg-panel p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm">
              <TeamLabel code={homeTeam} />
              <span className="tabular font-display text-lg font-bold text-ink">
                {homeScore}
                <span className="px-1 text-mute">–</span>
                {awayScore}
              </span>
              <TeamLabel code={awayTeam} />
              {live && <span className="ml-1 text-[10px] font-bold text-gold">AO VIVO</span>}
            </div>
            <p className="mt-1 text-xs text-mute">
              Palpites de todos {live && "· pontos pela prévia (placar atual)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-mute transition hover:text-ink"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : rows === null ? (
          <p className="text-sm text-mute">Carregando…</p>
        ) : (
          <div className="-mr-2 flex flex-col gap-0.5 overflow-y-auto pr-2">
            {rows.map((row) => {
              const isMe = row.userId === meId;
              return (
                <div
                  key={row.userId}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm",
                    isMe ? "bg-neon/10" : "",
                  )}
                >
                  <span className={cn("min-w-0 truncate", isMe ? "font-bold text-neon" : "text-ink")}>
                    {row.username === "Claude AI" ? "🤖 Claude AI" : row.username}
                    {isMe && <span className="ml-1 text-xs text-mute">(você)</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular text-mute">
                      {row.homePred}–{row.awayPred}
                    </span>
                    <span className={cn("tabular w-8 text-right font-bold", tone(row.base))}>
                      +{row.points}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
