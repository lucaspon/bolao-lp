"use client";

import { useState } from "react";
import { Target, Check } from "lucide-react";
import { getTeam } from "@/lib/teams";
import { STAGE_LABEL } from "@/lib/match";
import type { ResultFeedItem, ResultBettor } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

const MAX_NAMES = 12; // cap long "acertou o resultado" lists; rest collapse to "+N"

function TeamLabel({ code }: { code: string | null }) {
  const team = getTeam(code);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-sm leading-none">{team ? team.flag : "⚽"}</span>
      <span className="font-display font-semibold text-ink">{team ? team.code : "TBD"}</span>
    </span>
  );
}

function NameChips({
  people,
  meId,
  tone,
}: {
  people: ResultBettor[];
  meId: number;
  tone: "neon" | "gold";
}) {
  const [expanded, setExpanded] = useState(false);
  const hidden = people.length - MAX_NAMES;
  const shown = expanded ? people : people.slice(0, MAX_NAMES);
  const toneClass =
    tone === "neon" ? "bg-neon/15 text-neon" : "bg-gold/15 text-gold";

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((person) => (
        <span
          key={person.userId}
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] font-medium",
            person.userId === meId ? "bg-neon/25 font-bold text-neon ring-1 ring-neon/40" : toneClass,
          )}
        >
          {person.username === "Claude AI" ? "🤖 Claude AI" : person.username}
          {person.userId === meId && " (você)"}
        </span>
      ))}
      {!expanded && hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded px-1.5 py-0.5 text-[11px] font-medium text-mute hover:text-ink"
        >
          +{hidden}
        </button>
      )}
    </div>
  );
}

function ResultCard({ item, meId }: { item: ResultFeedItem; meId: number }) {
  const exactPts = 3 * item.multiplier;
  const correctPts = 1 * item.multiplier;
  const stageLabel =
    item.stage === "group" && item.groupLabel
      ? `Grupo ${item.groupLabel}`
      : STAGE_LABEL[item.stage];

  return (
    <div
      className={cn(
        "rounded-xl p-3",
        item.live ? "live-border bg-panel" : "border border-line bg-panel",
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <TeamLabel code={item.homeTeam} />
          <span
            className={cn(
              "tabular font-display text-lg font-bold",
              item.live ? "text-gold" : "text-ink",
            )}
          >
            {item.homeScore}
            <span className="px-1 text-mute">–</span>
            {item.awayScore}
          </span>
          <TeamLabel code={item.awayTeam} />
        </div>
        {item.live ? (
          <span className="flex shrink-0 items-center gap-1 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold text-gold">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" /> AO VIVO
            {item.multiplier > 1 && <span className="ml-0.5">×{item.multiplier}</span>}
          </span>
        ) : (
          <span className="shrink-0 rounded bg-panel2 px-1.5 py-0.5 text-[10px] font-semibold text-mute">
            {stageLabel}
            {item.multiplier > 1 && <span className="ml-1 text-gold">×{item.multiplier}</span>}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <span className="flex shrink-0 items-center gap-1 pt-0.5 text-[11px] font-bold text-neon">
            <Target size={12} /> CRAVOU +{exactPts}
          </span>
          {item.exact.length > 0 ? (
            <NameChips people={item.exact} meId={meId} tone="neon" />
          ) : (
            <span className="pt-0.5 text-[11px] text-mute">ninguém</span>
          )}
        </div>

        <div className="flex items-start gap-2">
          <span className="flex shrink-0 items-center gap-1 pt-0.5 text-[11px] font-bold text-gold">
            <Check size={12} /> RESULTADO +{correctPts}
          </span>
          {item.correct.length > 0 ? (
            <NameChips people={item.correct} meId={meId} tone="gold" />
          ) : (
            <span className="pt-0.5 text-[11px] text-mute">ninguém</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ResultsFeed({ items, meId }: { items: ResultFeedItem[]; meId: number }) {
  if (items.length === 0) return null;
  const hasLive = items.some((item) => item.live);
  return (
    <section className="lg:sticky lg:top-20 scrollbar-none">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-wide">Resultados recentes</h1>
        {hasLive && (
          <p className="text-xs text-mute">ao vivo = prévia, se o placar atual se mantiver</p>
        )}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
        {items.map((item) => (
          <ResultCard key={item.matchId} item={item} meId={meId} />
        ))}
      </div>
    </section>
  );
}
