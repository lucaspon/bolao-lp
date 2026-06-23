"use client";

import { useState } from "react";
import { GroupStandings } from "@/components/group-standings";
import { BracketView, type BracketPill } from "@/components/bracket-view";
import type { TeamStanding } from "@/lib/standings";
import { cn } from "@/lib/utils";

export type KnockoutData = {
  groups: Record<string, TeamStanding[]>;
  qualifyingThirdGroups: string[];
  pills: BracketPill[];
};

type View = "previa" | "oficial";

// Group standings + the bracket pre-filled from them. The Prévia view counts
// in-progress matches at their current score; Oficial counts only finished ones.
// Projected (not-yet-decided) teams render italic/dimmed in the bracket.
export function KnockoutView({ previa, oficial }: { previa: KnockoutData; oficial: KnockoutData }) {
  const [view, setView] = useState<View>("previa");
  const data = view === "previa" ? previa : oficial;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-mute">
          Classificação dos grupos e chaveamento projetado.{" "}
          <span className="italic text-mute">Times em itálico</span> são prévia.
        </p>
        <div className="flex rounded-lg border border-line p-0.5 text-xs font-semibold">
          {(["previa", "oficial"] as View[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={cn(
                "rounded-md px-2.5 py-1 transition",
                view === option ? "bg-panel2 text-ink" : "text-mute hover:text-ink",
              )}
            >
              {option === "previa" ? "Prévia" : "Oficial"}
            </button>
          ))}
        </div>
      </div>

      <GroupStandings groups={data.groups} qualifyingThirdGroups={data.qualifyingThirdGroups} />

      <BracketView matches={data.pills} />
    </div>
  );
}
