"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import type { MatchWithBet } from "@/lib/db/queries";

// The user's picks: live/upcoming matches first (nearest kickoff first — picks
// arrive sorted by kickoff, so live games sit ahead of upcoming ones), with the
// already-played matches collapsed behind a toggle.
export function MyBets({ picks }: { picks: MatchWithBet[] }) {
  const [showDone, setShowDone] = useState(false);

  const active = picks.filter((match) => match.status !== "finished");
  const done = picks
    .filter((match) => match.status === "finished")
    .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime());

  return (
    <div className="space-y-4">
      {active.length > 0 ? (
        <div className="grid gap-3">
          {active.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-mute">
          Nenhum jogo pendente — todos os seus palpites já foram disputados.
        </p>
      )}

      {done.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-sm font-semibold text-mute transition hover:border-neon/60 hover:text-neon"
          >
            {showDone ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {showDone ? "Ocultar concluídos" : `Mostrar concluídos (${done.length})`}
          </button>
          {showDone && (
            <div className="grid gap-3">
              {done.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
