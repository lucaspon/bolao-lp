import type { Stage } from "./db/schema";

// The 2026 World Cup knockout bracket, encoded once. football-data.org gives us
// the schedule and (eventually) the qualified teams, but no bracket linkage and
// no FIFA match numbers — so the structure and the apiMatchId→match-number map
// below are our own reference data. The map was reconciled 1:1 against the DB by
// matching each match's UTC kickoff to the official FIFA schedule (date + venue).

// A slot is "who plays here": a group position, a best-third pool, or the
// winner/loser of an earlier match. Shown as a label until the team is decided.
export type Slot =
  | { kind: "groupWinner"; group: string }
  | { kind: "groupRunnerUp"; group: string }
  | { kind: "thirdPlace"; groups: string[] }
  | { kind: "winnerOf"; match: number }
  | { kind: "loserOf"; match: number };

export type BracketMatch = { round: Stage; home: Slot; away: Slot };

const w = (group: string): Slot => ({ kind: "groupWinner", group });
const r = (group: string): Slot => ({ kind: "groupRunnerUp", group });
const t = (groups: string): Slot => ({ kind: "thirdPlace", groups: groups.split("") });
const W = (match: number): Slot => ({ kind: "winnerOf", match });
const L = (match: number): Slot => ({ kind: "loserOf", match });

export const BRACKET: Record<number, BracketMatch> = {
  // Round of 32
  73: { round: "round_of_32", home: r("A"), away: r("B") },
  74: { round: "round_of_32", home: w("E"), away: t("ABCDF") },
  75: { round: "round_of_32", home: w("F"), away: r("C") },
  76: { round: "round_of_32", home: w("C"), away: r("F") },
  77: { round: "round_of_32", home: w("I"), away: t("CDFGH") },
  78: { round: "round_of_32", home: r("E"), away: r("I") },
  79: { round: "round_of_32", home: w("A"), away: t("CEFHI") },
  80: { round: "round_of_32", home: w("L"), away: t("EHIJK") },
  81: { round: "round_of_32", home: w("D"), away: t("BEFIJ") },
  82: { round: "round_of_32", home: w("G"), away: t("AEHIJ") },
  83: { round: "round_of_32", home: r("K"), away: r("L") },
  84: { round: "round_of_32", home: w("H"), away: r("J") },
  85: { round: "round_of_32", home: w("B"), away: t("EFGIJ") },
  86: { round: "round_of_32", home: w("J"), away: r("H") },
  87: { round: "round_of_32", home: w("K"), away: t("DEIJL") },
  88: { round: "round_of_32", home: r("D"), away: r("G") },
  // Round of 16
  89: { round: "round_of_16", home: W(74), away: W(77) },
  90: { round: "round_of_16", home: W(73), away: W(75) },
  91: { round: "round_of_16", home: W(76), away: W(78) },
  92: { round: "round_of_16", home: W(79), away: W(80) },
  93: { round: "round_of_16", home: W(83), away: W(84) },
  94: { round: "round_of_16", home: W(81), away: W(82) },
  95: { round: "round_of_16", home: W(86), away: W(88) },
  96: { round: "round_of_16", home: W(85), away: W(87) },
  // Quarter-finals
  97: { round: "quarter", home: W(89), away: W(90) },
  98: { round: "quarter", home: W(93), away: W(94) },
  99: { round: "quarter", home: W(91), away: W(92) },
  100: { round: "quarter", home: W(95), away: W(96) },
  // Semi-finals
  101: { round: "semi", home: W(97), away: W(98) },
  102: { round: "semi", home: W(99), away: W(100) },
  // Third place + Final
  103: { round: "third_place", home: L(101), away: L(102) },
  104: { round: "final", home: W(101), away: W(102) },
};

// Compact label shown inside a pill before the real team is known.
export function slotShortLabel(slot: Slot): string {
  switch (slot.kind) {
    case "groupWinner":
      return `1${slot.group}`;
    case "groupRunnerUp":
      return `2${slot.group}`;
    case "thirdPlace":
      return "3rd";
    case "winnerOf":
      return `W${slot.match}`;
    case "loserOf":
      return `L${slot.match}`;
  }
}

// apiMatchId (football-data.org) → FIFA match number (73–104).
export const MATCH_NO_BY_API_ID: Record<number, number> = {
  537417: 73, 537415: 74, 537418: 75, 537423: 76, 537416: 77, 537424: 78,
  537425: 79, 537426: 80, 537421: 81, 537422: 82, 537419: 83, 537420: 84,
  537429: 85, 537427: 86, 537430: 87, 537428: 88, 537375: 89, 537376: 90,
  537377: 91, 537378: 92, 537379: 93, 537380: 94, 537381: 95, 537382: 96,
  537383: 97, 537384: 98, 537385: 99, 537386: 100, 537387: 101, 537388: 102,
  537389: 103, 537390: 104,
};

export function matchNoForApiId(apiId: number | null | undefined): number | null {
  if (apiId == null) return null;
  return MATCH_NO_BY_API_ID[apiId] ?? null;
}

// Mirror layout, top→bottom per column. The left half flows right and the right
// half flows left, so the two semi-finals meet the Final/3rd in the centre. Each
// later round sits between the two matches that feed it.
export const LEFT_COLUMNS: number[][] = [
  [74, 77, 73, 75, 83, 84, 81, 82], // R32
  [89, 90, 93, 94], // R16
  [97, 98], // QF
  [101], // SF
];

export const RIGHT_COLUMNS: number[][] = [
  [102], // SF
  [99, 100], // QF
  [91, 92, 95, 96], // R16
  [76, 78, 79, 80, 86, 88, 85, 87], // R32
];

export const CENTER = { final: 104, third: 103 } as const;

// Fails loudly if the encoded bracket is internally inconsistent. Used by the
// build-time check; never a silent fallback.
export function assertBracketIntegrity(): void {
  for (let no = 73; no <= 104; no += 1) {
    if (!BRACKET[no]) throw new Error(`bracket: missing match ${no}`);
  }
  for (const [noStr, match] of Object.entries(BRACKET)) {
    const no = Number(noStr);
    for (const slot of [match.home, match.away]) {
      if (slot.kind === "winnerOf" || slot.kind === "loserOf") {
        if (!BRACKET[slot.match]) throw new Error(`match ${no} feeds from missing ${slot.match}`);
        if (slot.match >= no) throw new Error(`match ${no} feeds from non-earlier ${slot.match}`);
      }
    }
  }
  const laidOut = [...LEFT_COLUMNS.flat(), ...RIGHT_COLUMNS.flat(), CENTER.final, CENTER.third];
  const unique = new Set(laidOut);
  if (laidOut.length !== 32 || unique.size !== 32) {
    throw new Error(`bracket layout must place all 32 matches once (got ${laidOut.length}, ${unique.size} unique)`);
  }
  for (const no of laidOut) {
    if (no < 73 || no > 104) throw new Error(`bracket layout has out-of-range match ${no}`);
  }
}
