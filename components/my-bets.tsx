"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import type { MatchWithBet } from "@/lib/db/queries";

// Column count by viewport (max 4). Drives both the grid and the row chunking
// so the row dividers land exactly between rows.
function useColumns() {
  const [cols, setCols] = useState(1); // safe pre-mount default (no squished cards)
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      // 4 cols only on wide screens — the editable stepper cards need room (the
      // page is ~70vw, so 4 cols stay ≥ ~250px from here up).
      setCols(w >= 1536 ? 4 : w >= 1152 ? 3 : w >= 720 ? 2 : 1);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return cols;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

function CardRows({ matches, cols }: { matches: MatchWithBet[]; cols: number }) {
  return (
    <div className="divide-y divide-line/60">
      {chunk(matches, cols).map((row, i) => (
        <div
          key={i}
          className="grid gap-3 py-3 first:pt-0 last:pb-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {row.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ))}
    </div>
  );
}

// The user's picks: live/upcoming first (nearest kickoff first — picks arrive
// sorted by kickoff), laid out in up to 4 columns with a divider between rows.
// Already-played matches are collapsed behind a toggle.
export function MyBets({ picks }: { picks: MatchWithBet[] }) {
  const cols = useColumns();
  const [showDone, setShowDone] = useState(false);

  const active = picks.filter((match) => match.status !== "finished");
  const done = picks
    .filter((match) => match.status === "finished")
    .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime());

  return (
    <div className="space-y-4">
      {active.length > 0 ? (
        <CardRows matches={active} cols={cols} />
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
          {showDone && <CardRows matches={done} cols={cols} />}
        </div>
      )}
    </div>
  );
}
