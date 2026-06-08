"use client";

import { Fragment } from "react";
import { MatchPill, type PillMatch } from "@/components/match-pill";
import { BRACKET, CENTER, LEFT_COLUMNS, RIGHT_COLUMNS } from "@/lib/bracket";
import { STAGE_LABEL } from "@/lib/match";
import type { Stage } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export type BracketPill = PillMatch & { matchNo: number };

// Vertical rhythm for the desktop bracket. Each Round of 32 match gets one SLOT;
// the whole half is exactly 8 slots tall, so every later round (4, 2, 1 matches)
// centres itself between its feeders with `justify-around`.
const SLOT = 60;
const HALF_HEIGHT = SLOT * 8;
const PILL_W = "w-[150px]";

function Pill({ pill, emphasis }: { pill: BracketPill | undefined; emphasis?: boolean }) {
  if (!pill) {
    return <div className={cn(PILL_W, "h-9 rounded-lg border border-line/40 bg-panel/40")} />;
  }
  return (
    <div className={PILL_W}>
      <MatchPill match={pill} emphasis={emphasis} />
    </div>
  );
}

function RoundColumn({
  nos,
  byNo,
}: {
  nos: number[];
  byNo: Map<number, BracketPill>;
}) {
  return (
    <div className="flex flex-col justify-around" style={{ height: HALF_HEIGHT }}>
      {nos.map((no) => (
        <div key={no} className="flex items-center">
          <Pill pill={byNo.get(no)} />
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
            "w-3 border-y border-line/70",
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
}: {
  columns: number[][];
  side: "left" | "right";
  byNo: Map<number, BracketPill>;
}) {
  return (
    <div className="flex items-stretch">
      {columns.map((nos, index) => {
        const last = index === columns.length - 1;
        const feederCount = side === "left" ? nos.length : columns[index + 1]?.length ?? 0;
        return (
          <Fragment key={index}>
            <RoundColumn nos={nos} byNo={byNo} />
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
  const byNo = new Map(matches.map((match) => [match.matchNo, match]));

  return (
    <div>
      {/* Desktop: horizontal mirror bracket with Final + 3rd in the centre.
          Breaks out of the page's max-w-6xl column to use the full viewport. */}
      <div className="hidden overflow-x-auto pb-2 lg:ml-[calc(50%-50vw)] lg:flex lg:w-screen lg:justify-center lg:px-8">
        <Half columns={LEFT_COLUMNS} side="left" byNo={byNo} />

        <div
          className="flex flex-col items-center justify-center gap-2 px-2"
          style={{ height: HALF_HEIGHT }}
        >
          <span className="font-display text-xs font-bold uppercase tracking-wide text-gold">
            Final
          </span>
          <Pill pill={byNo.get(CENTER.final)} emphasis />
          <span className="mt-3 text-[10px] uppercase tracking-wide text-mute">
            3rd place
          </span>
          <Pill pill={byNo.get(CENTER.third)} />
        </div>

        <Half columns={RIGHT_COLUMNS} side="right" byNo={byNo} />
      </div>

      {/* Mobile: stacked round-by-round list. */}
      <div className="flex flex-col gap-5 lg:hidden">
        {MOBILE_ROUNDS.map((round) => {
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
        <span className="text-ink">1X</span> winner group X ·{" "}
        <span className="text-ink">2X</span> runner-up X ·{" "}
        <span className="text-ink">3rd</span> best third-placed ·{" "}
        <span className="text-ink">W##</span> winner of match ## ·{" "}
        <span className="text-ink">L##</span> loser of match ##
      </p>
    </div>
  );
}
