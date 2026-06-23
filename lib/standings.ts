import type { Match } from "./db/schema";
import { BRACKET } from "./bracket";

// Group-stage table + a projection of who fills each Round-of-32 slot, used to
// pre-fill the bracket. "Official" counts only finished matches; "prévia" also
// counts in-play matches at their current score.

export type TeamStanding = {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export type SlotFill = { team: string | null; preview: boolean };

export type Standings = {
  groups: Record<string, TeamStanding[]>; // sorted best → worst, 4 per group
  groupComplete: Record<string, boolean>; // all 6 group matches finished
  qualifyingThirdGroups: Set<string>; // the 8 best third-placed groups
  // Projected team for a Round-of-32 slot (group-based slots only). `preview` is
  // true while the result isn't yet locked (group still playing / thirds not
  // all decided). Returns null team for non-group slots (winner/loser-of).
  r32Slot: (matchNo: number, side: "home" | "away") => SlotFill;
};

const blank = (team: string): TeamStanding => ({
  team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0,
});

// Points → goal difference → goals for → name. (Head-to-head and fair-play
// tiebreakers are omitted; this is a projection, replaced by official data.)
const rank = (a: TeamStanding, b: TeamStanding) =>
  b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team);

export function computeStandings(matches: Match[], includeLive: boolean): Standings {
  const groupMatches = matches.filter((m) => m.stage === "group");
  const byGroup = new Map<string, Map<string, TeamStanding>>();
  const ensure = (group: string, team: string) => {
    let g = byGroup.get(group);
    if (!g) byGroup.set(group, (g = new Map()));
    let s = g.get(team);
    if (!s) g.set(team, (s = blank(team)));
    return s;
  };

  // Seed every known team (so a group still shows all four even before kickoff).
  for (const m of groupMatches) {
    if (m.groupLabel && m.homeTeam) ensure(m.groupLabel, m.homeTeam);
    if (m.groupLabel && m.awayTeam) ensure(m.groupLabel, m.awayTeam);
  }

  const counts = (m: Match) =>
    m.status === "finished" || (includeLive && m.status === "live");

  for (const m of groupMatches) {
    if (!m.groupLabel || !m.homeTeam || !m.awayTeam) continue;
    if (m.homeScore == null || m.awayScore == null || !counts(m)) continue;
    const h = ensure(m.groupLabel, m.homeTeam);
    const a = ensure(m.groupLabel, m.awayTeam);
    h.played += 1; a.played += 1;
    h.gf += m.homeScore; h.ga += m.awayScore;
    a.gf += m.awayScore; a.ga += m.homeScore;
    h.gd = h.gf - h.ga; a.gd = a.gf - a.ga;
    if (m.homeScore > m.awayScore) { h.won += 1; h.points += 3; a.lost += 1; }
    else if (m.homeScore < m.awayScore) { a.won += 1; a.points += 3; h.lost += 1; }
    else { h.drawn += 1; a.drawn += 1; h.points += 1; a.points += 1; }
  }

  const groups: Record<string, TeamStanding[]> = {};
  const groupComplete: Record<string, boolean> = {};
  for (const [group, table] of byGroup) {
    groups[group] = [...table.values()].sort(rank);
    groupComplete[group] =
      groupMatches.filter((m) => m.groupLabel === group && m.status === "finished").length >= 6;
  }
  const allComplete =
    Object.keys(groups).length >= 12 && Object.values(groupComplete).every(Boolean);

  // Rank the 12 third-placed teams; the best 8 advance.
  const thirds = Object.entries(groups)
    .map(([group, table]) => ({ group, st: table[2] }))
    .filter((e): e is { group: string; st: TeamStanding } => !!e.st)
    .sort((a, b) => rank(a.st, b.st));
  const qualifyingThirdGroups = new Set(thirds.slice(0, 8).map((e) => e.group));

  // Greedily map qualifying thirds to the bracket's third-place slots (each slot
  // lists the groups it may draw from). Best-ranked third claims the first slot
  // whose candidate set includes its group. (An approximation of FIFA's official
  // allocation table — fine for a projection.)
  const thirdAssign = new Map<string, string>(); // `${matchNo}:${side}` → group
  const used = new Set<string>();
  for (let no = 73; no <= 88; no += 1) {
    const spec = BRACKET[no];
    if (!spec) continue;
    for (const side of ["home", "away"] as const) {
      const slot = spec[side];
      if (slot.kind !== "thirdPlace") continue;
      const pick = thirds.find(
        (e) => qualifyingThirdGroups.has(e.group) && slot.groups.includes(e.group) && !used.has(e.group),
      );
      if (pick) {
        thirdAssign.set(`${no}:${side}`, pick.group);
        used.add(pick.group);
      }
    }
  }

  const r32Slot = (matchNo: number, side: "home" | "away"): SlotFill => {
    const slot = BRACKET[matchNo]?.[side];
    if (!slot) return { team: null, preview: false };
    if (slot.kind === "groupWinner") {
      return { team: groups[slot.group]?.[0]?.team ?? null, preview: !groupComplete[slot.group] };
    }
    if (slot.kind === "groupRunnerUp") {
      return { team: groups[slot.group]?.[1]?.team ?? null, preview: !groupComplete[slot.group] };
    }
    if (slot.kind === "thirdPlace") {
      const group = thirdAssign.get(`${matchNo}:${side}`);
      return { team: group ? groups[group]?.[2]?.team ?? null : null, preview: !allComplete };
    }
    return { team: null, preview: false };
  };

  return { groups, groupComplete, qualifyingThirdGroups, r32Slot };
}
