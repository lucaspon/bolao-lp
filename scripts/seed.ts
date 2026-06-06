// Seeds the match schedule: 72 group-stage fixtures (round-robin per group) plus
// the full knockout bracket as editable placeholders. Idempotent — re-running
// skips any match that already exists (so admin edits and results survive).
//
// Run with:  npm run db:seed
import { db } from "../lib/db/client";
import { matches } from "../lib/db/schema";
import { GROUPS, GROUP_LABELS, VENUES } from "../lib/teams";

type NewMatch = typeof matches.$inferInsert;

const DAY = 86_400_000;
const HOUR = 3_600_000;

function utc(year: number, monthIndex0: number, day: number): number {
  return Date.UTC(year, monthIndex0, day, 0, 0, 0);
}

let venueCursor = 0;
const nextVenue = () => VENUES[venueCursor++ % VENUES.length];

const rows: NewMatch[] = [];

// --- Group stage: round-robin, 6 matches per group ---------------------------
// Pairings by team index within the group, ordered into 3 matchdays.
const roundRobin: [number, number][] = [
  [0, 1],
  [2, 3], // matchday 1
  [0, 2],
  [3, 1], // matchday 2
  [0, 3],
  [1, 2], // matchday 3
];

const groupStageStart = utc(2026, 5, 11); // 11 June 2026

GROUP_LABELS.forEach((label, groupIndex) => {
  const teams = GROUPS[label];
  roundRobin.forEach((pair, idx) => {
    const matchday = Math.floor(idx / 2); // 0..2
    const slotInDay = idx % 2; // 0 or 1
    const dayOffset = Math.floor(groupIndex / 2) + matchday * 6;
    const hour = 16 + slotInDay * 3 + (groupIndex % 2); // spread kickoffs
    rows.push({
      extId: `G-${label}-${idx + 1}`,
      stage: "group",
      groupLabel: label,
      homeTeam: teams[pair[0]],
      awayTeam: teams[pair[1]],
      kickoffAt: new Date(groupStageStart + dayOffset * DAY + hour * HOUR),
      venue: nextVenue(),
    });
  });
});

// --- Knockouts: placeholders until teams are decided -------------------------
function knockout(
  extId: string,
  stage: NewMatch["stage"],
  home: string,
  away: string,
  startMs: number,
): NewMatch {
  return {
    extId,
    stage,
    homePlaceholder: home,
    awayPlaceholder: away,
    kickoffAt: new Date(startMs),
    venue: nextVenue(),
  };
}

// Round of 32: 12 group winners + 12 runners-up + 8 best third-placed = 32 teams.
const r32Pool = [
  ...GROUP_LABELS.map((l) => `Winner Group ${l}`),
  ...GROUP_LABELS.map((l) => `Runner-up Group ${l}`),
  ...Array.from({ length: 8 }, (_, i) => `Best 3rd #${i + 1}`),
];

const r32Start = utc(2026, 5, 29); // 29 June
for (let i = 0; i < 16; i++) {
  const dayOffset = Math.floor(i / 4);
  const hour = 16 + (i % 4) * 2;
  rows.push(
    knockout(
      `R32-${i + 1}`,
      "round_of_32",
      r32Pool[i * 2],
      r32Pool[i * 2 + 1],
      r32Start + dayOffset * DAY + hour * HOUR,
    ),
  );
}

function bracketRound(
  prefix: string,
  stage: NewMatch["stage"],
  fromPrefix: string,
  count: number,
  startDay: number,
  perDay: number,
) {
  for (let j = 0; j < count; j++) {
    const dayOffset = Math.floor(j / perDay);
    const hour = 16 + (j % perDay) * 3;
    rows.push(
      knockout(
        `${prefix}-${j + 1}`,
        stage,
        `Winner ${fromPrefix}-${j * 2 + 1}`,
        `Winner ${fromPrefix}-${j * 2 + 2}`,
        startDay + dayOffset * DAY + hour * HOUR,
      ),
    );
  }
}

bracketRound("R16", "round_of_16", "R32", 8, utc(2026, 6, 4), 2); // 4–7 July
bracketRound("QF", "quarter", "R16", 4, utc(2026, 6, 9), 2); // 9–11 July
bracketRound("SF", "semi", "QF", 2, utc(2026, 6, 14), 1); // 14–15 July

rows.push(
  knockout("3P", "third_place", "Loser SF-1", "Loser SF-2", utc(2026, 6, 18) + 16 * HOUR),
);
rows.push(
  knockout("FIN", "final", "Winner SF-1", "Winner SF-2", utc(2026, 6, 19) + 16 * HOUR),
);

async function main() {
  const inserted = await db
    .insert(matches)
    .values(rows)
    .onConflictDoNothing({ target: matches.extId })
    .returning({ id: matches.id });

  console.log(
    `Seed complete. ${rows.length} fixtures prepared, ${inserted.length} newly inserted.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
