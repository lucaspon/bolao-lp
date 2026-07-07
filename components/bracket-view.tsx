"use client";

import { Fragment, useState } from "react";
import { MatchPill, type PillMatch } from "@/components/match-pill";
import { BRACKET, CENTER, LEFT_COLUMNS, RIGHT_COLUMNS } from "@/lib/bracket";
import { STAGE_LABEL } from "@/lib/match";
import type { Stage } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export type BracketPill = PillMatch & { matchNo: number };

// Vertical rhythm for the desktop bracket. Each Round of 32 match gets one SLOT;
// the whole half is exactly 8 slots tall, so every later round (4, 2, 1 matches)
// centres itself between its feeders with `justify-around`. SLOT must comfortably
// exceed a (compact) pill's height — pills are min-h 68px — so 8 of them fit the
// half without overflowing past it into the footer.
const SLOT = 80;
const HALF_HEIGHT = SLOT * 8;
// Wider pills once Round of 32 is hidden — one fewer column means more room
// per card, so team names and venue text stop truncating.
const PILL_W_NARROW = "w-[128px]";
const PILL_W_WIDE = "w-[168px]";

function Pill({
  pill,
  emphasis,
  wide,
}: {
  pill: BracketPill | undefined;
  emphasis?: boolean;
  wide?: boolean;
}) {
  const widthClass = wide ? PILL_W_WIDE : PILL_W_NARROW;
  if (!pill) {
    return <div className={cn(widthClass, "h-9 rounded-lg border border-line/40 bg-panel/40")} />;
  }
  return (
    <div className={widthClass}>
      <MatchPill match={pill} emphasis={emphasis} compact />
    </div>
  );
}

function RoundColumn({
  nos,
  byNo,
  wide,
}: {
  nos: number[];
  byNo: Map<number, BracketPill>;
  wide?: boolean;
}) {
  return (
    <div className="flex flex-col justify-around" style={{ height: HALF_HEIGHT }}>
      {nos.map((no) => (
        <div key={no} className="flex items-center py-0.5">
          <Pill pill={byNo.get(no)} wide={wide} />
        </div>
      ))}
    </div>
  );
}

// Elbows linking each pair of feeder pills to the single match they feed. There
// are feederCount/2 of them; each is feederCount-th of the column tall, so its
// top/bottom edges land on the two feeders' centres.
function Connectors({ feederCount, side }: { feederCount: number; side: "left" | "right" }) {
  const items = Array.from({ length: feederCount / 2 });
  return (
    <div className="flex flex-col justify-around" style={{ height: HALF_HEIGHT }}>
      {items.map((_, index) => (
        <div
          key={index}
          style={{ height: HALF_HEIGHT / feederCount }}
          className={cn(
            "w-2.5 border-y border-line/70",
            side === "left" ? "rounded-r-md border-r" : "rounded-l-md border-l",
          )}
        />
      ))}
    </div>
  );
}

// One half of the mirror. `columns` are in visual left→right order; the feeder
// round (more matches) is on the outer side, so left-half elbows open right and
// right-half elbows open left.
function Half({
  columns,
  side,
  byNo,
  wide,
}: {
  columns: number[][];
  side: "left" | "right";
  byNo: Map<number, BracketPill>;
  wide?: boolean;
}) {
  return (
    <div className="flex items-stretch">
      {columns.map((nos, index) => {
        const last = index === columns.length - 1;
        const feederCount = side === "left" ? nos.length : columns[index + 1]?.length ?? 0;
        return (
          <Fragment key={index}>
            <RoundColumn nos={nos} byNo={byNo} wide={wide} />
            {!last && <Connectors feederCount={feederCount} side={side} />}
          </Fragment>
        );
      })}
    </div>
  );
}

const MOBILE_ROUNDS: Stage[] = [
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "third_place",
  "final",
];

export function BracketView({ matches }: { matches: BracketPill[] }) {
  const [showR32, setShowR32] = useState(false);
  const byNo = new Map(matches.map((match) => [match.matchNo, match]));
  const leftColumns = showR32 ? LEFT_COLUMNS : LEFT_COLUMNS.slice(1);
  const rightColumns = showR32 ? RIGHT_COLUMNS : RIGHT_COLUMNS.slice(0, -1);
  const mobileRounds = showR32 ? MOBILE_ROUNDS : MOBILE_ROUNDS.filter((r) => r !== "round_of_32");

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setShowR32((v) => !v)}
          className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-mute transition hover:text-ink"
        >
          {showR32 ? "Ocultar 16-avos" : "Mostrar 16-avos"}
        </button>
      </div>

      {/* Desktop: horizontal mirror bracket with Final + 3rd in the centre.
          Breaks out of the page's max-w-6xl column to use the full viewport. */}
      <div
        className="hidden pb-2 lg:relative lg:left-[calc(50%-50vw)] lg:flex lg:w-screen lg:justify-center lg:px-8"
        style={{ minHeight: HALF_HEIGHT }}
      >
        <Half columns={leftColumns} side="left" byNo={byNo} wide={!showR32} />

        <div
          className="flex flex-col items-center justify-center gap-2 px-2"
          style={{ height: HALF_HEIGHT }}
        >
          <span className="font-display text-xs font-bold uppercase tracking-wide text-gold">
            Final
          </span>
          <Pill pill={byNo.get(CENTER.final)} emphasis wide={!showR32} />
          <span className="mt-3 text-[10px] uppercase tracking-wide text-mute">
            3º lugar
          </span>
          <Pill pill={byNo.get(CENTER.third)} wide={!showR32} />
        </div>

        <Half columns={rightColumns} side="right" byNo={byNo} wide={!showR32} />
      </div>

      {/* Mobile: stacked round-by-round list. */}
      <div className="flex flex-col gap-5 lg:hidden">
        {mobileRounds.map((round) => {
          const nos = matches
            .filter((match) => BRACKET[match.matchNo]?.round === round)
            .map((match) => match.matchNo)
            .sort((a, b) => a - b);
          if (nos.length === 0) return null;
          return (
            <div key={round}>
              <h3 className="mb-2 font-display text-sm font-bold tracking-wide text-neon">
                {STAGE_LABEL[round]}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {nos.map((no) => (
                  <MatchPill key={no} match={byNo.get(no)!} emphasis={no === CENTER.final} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Notation legend. */}
      <p className="mt-5 text-center text-[11px] text-mute">
        <span className="text-ink">1X</span> 1º do grupo X ·{" "}
        <span className="text-ink">2X</span> 2º do grupo X ·{" "}
        <span className="text-ink">3º</span> melhor 3º colocado ·{" "}
        <span className="text-ink">V##</span> vencedor do jogo ## ·{" "}
        <span className="text-ink">P##</span> perdedor do jogo ##
      </p>
    </div>
  );
}
