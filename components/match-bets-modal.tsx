"use client";

import { Fragment, useEffect, useState } from "react";
import { X } from "lucide-react";
import { getTeam } from "@/lib/teams";
import { scoreBet } from "@/lib/scoring";
import { getMatchBetsAction } from "@/app/actions/bets";
import type { MatchBet } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

const code = (c: string | null) => getTeam(c)?.code ?? c ?? "?";

function TeamLabel({ code: c }: { code: string | null }) {
  const team = getTeam(c);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-sm leading-none">{team ? team.flag : "⚽"}</span>
      <span className="font-display font-semibold text-ink">{team ? team.code : "TBD"}</span>
    </span>
  );
}

type Row = MatchBet & { base: number; points: number };

// Grid of predicted scorelines → how many people bet each one; the actual result
// cell is ringed in gold, others shaded by frequency.
function ScoreMatrix({
  rows,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
}: {
  rows: Row[];
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
}) {
  const maxH = Math.max(3, homeScore, ...rows.map((r) => r.homePred));
  const maxA = Math.max(3, awayScore, ...rows.map((r) => r.awayPred));
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.homePred}:${r.awayPred}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const maxCount = Math.max(1, ...counts.values());
  const homes = Array.from({ length: maxH + 1 }, (_, i) => i);
  const aways = Array.from({ length: maxA + 1 }, (_, i) => i);

  return (
    <div className="shrink-0">
      <div className="mb-2 text-xs font-semibold text-mute">Mapa de placares</div>
      <div
        className="inline-grid gap-0.5 text-[10px]"
        style={{ gridTemplateColumns: `16px repeat(${aways.length}, 22px)` }}
      >
        <div />
        {aways.map((a) => (
          <div key={a} className="text-center font-semibold text-mute">
            {a}
          </div>
        ))}
        {homes.map((h) => (
          <Fragment key={h}>
            <div className="flex items-center justify-center font-semibold text-mute">{h}</div>
            {aways.map((a) => {
              const count = counts.get(`${h}:${a}`) ?? 0;
              const isResult = h === homeScore && a === awayScore;
              return (
                <div
                  key={a}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded text-ink",
                    isResult && "ring-1 ring-gold",
                  )}
                  style={{
                    background:
                      count > 0
                        ? `rgba(52,226,122,${(0.12 + 0.55 * (count / maxCount)).toFixed(2)})`
                        : "rgba(255,255,255,0.03)",
                  }}
                >
                  {count > 0 ? count : ""}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-1.5 max-w-[160px] text-[10px] leading-tight text-mute">
        linhas {code(homeTeam)} (casa) · colunas {code(awayTeam)} (fora) ·{" "}
        <span className="text-gold">▢ resultado</span>
      </div>
    </div>
  );
}

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
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-line bg-panel p-5 shadow-xl"
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
          <div className="flex flex-col gap-5 overflow-y-auto lg:flex-row lg:gap-6">
            <ScoreMatrix
              rows={rows}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              homeScore={homeScore}
              awayScore={awayScore}
            />
            <div className="min-w-0 flex-1">
              <div className="gap-x-4 sm:columns-2">
                {rows.map((row) => {
                  const isMe = row.userId === meId;
                  return (
                    <div
                      key={row.userId}
                      className={cn(
                        "flex break-inside-avoid items-center justify-between gap-3 rounded px-2 py-1 text-sm",
                        isMe ? "bg-neon/10" : "",
                      )}
                    >
                      <span className={cn("min-w-0 truncate", isMe ? "font-bold text-neon" : "text-ink")}>
                        {row.username === "Claude AI" ? "🤖 Claude AI" : row.username}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tabular text-mute">
                          {row.homePred}–{row.awayPred}
                        </span>
                        <span className={cn("tabular w-7 text-right font-bold", tone(row.base))}>
                          +{row.points}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
