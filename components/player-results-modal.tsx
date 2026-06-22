"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTeam } from "@/lib/teams";
import type { LeaderRow, ScoredBet } from "@/lib/db/queries";

function flagOf(code: string | null): string {
  return getTeam(code)?.flag ?? "⚽";
}

function codeOf(code: string | null): string {
  return code ?? "?";
}

const brl = (cents: number) => `R$${(cents / 100).toFixed(0)}`;

// A single match the player scored on, as a card in the results grid.
function ResultCard({ bet }: { bet: ScoredBet }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-line bg-panel2 px-2 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] font-medium text-mute">
        <span>{flagOf(bet.homeTeam)}</span>
        <span>{codeOf(bet.homeTeam)}</span>
        <span className="text-mute/50">×</span>
        <span>{codeOf(bet.awayTeam)}</span>
        <span>{flagOf(bet.awayTeam)}</span>
      </div>
      <div className="font-display text-lg font-bold text-ink">
        {bet.homeScore} <span className="text-mute">x</span> {bet.awayScore}
      </div>
      <div className="text-xs font-bold text-neon">+{bet.points}pts</div>
    </div>
  );
}

// Spacious, info-complete breakdown of one player: summary stats plus a grid
// (6 columns on lg) of every match they scored points on. Replaces the old
// hover tooltip with a click-triggered modal.
export function PlayerResultsModal({
  row,
  rank,
  bets,
  prizeCents,
  pct,
  isMe,
  hasLive,
  onClose,
}: {
  row: LeaderRow;
  rank: number;
  bets: ScoredBet[];
  prizeCents: number;
  pct: string;
  isMe: boolean;
  hasLive: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isClaude = row.username === "Claude AI";

  const stats: { label: string; value: string; accent: string }[] = [
    { label: "Pontos", value: String(row.points), accent: "text-ink" },
    ...(hasLive
      ? [{ label: "Ao vivo", value: String(row.livePoints), accent: "text-danger" }]
      : []),
    { label: "Cravadas", value: String(row.exact), accent: "text-ink" },
    { label: "Resultado", value: String(row.correct), accent: "text-ink" },
    { label: "Palpites", value: String(row.picks), accent: "text-ink" },
    { label: "Pts %", value: pct, accent: "text-ink" },
    { label: "Aposta", value: row.stakeCents > 0 ? brl(row.stakeCents) : "–", accent: "text-ink" },
    { label: "Prêmio", value: prizeCents > 0 ? brl(prizeCents) : "–", accent: "text-gold" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="text-mute">#{rank}</span>
            {isClaude ? (
              <span>
                🤖 <span className="font-mono">{row.username}</span>
              </span>
            ) : (
              <span className={isMe ? "text-neon" : "text-ink"}>{row.username}</span>
            )}
            {isMe && <span className="text-xs font-normal text-mute">(você)</span>}
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

        <div className="mb-6 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-line bg-panel2 px-3 py-2.5 text-center"
            >
              <div className="text-[10px] uppercase tracking-wide text-mute">{stat.label}</div>
              <div className={cn("font-display text-xl font-bold", stat.accent)}>{stat.value}</div>
            </div>
          ))}
        </div>

        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-mute">
          Pontuou em {bets.length} {bets.length === 1 ? "jogo" : "jogos"}
        </h3>
        {bets.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {bets.map((bet, index) => (
              <ResultCard key={index} bet={bet} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-line bg-panel2 p-4 text-sm text-mute">
            Ainda não pontuou em nenhum jogo.
          </p>
        )}
      </div>
    </div>
  );
}
