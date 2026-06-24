import { db } from "./db/client";
import { matches, type Match } from "./db/schema";
import { applyLiveScore, setMatchVenueIfMissing } from "./db/queries";
import { TEAMS } from "./teams";
import { venueLabel } from "./venues";

// Live in-play scores from ESPN's free public scoreboard (no API key, no quota).
// football-data owns the schedule and final results; this only overlays the live
// score while a match is in progress.
const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

const MINUTE_MS = 60_000;
const PRE_KICKOFF_MS = 2 * MINUTE_MS;
// Generous post-kickoff window — covers extra time, penalties and rain delays.
// ESPN is unmetered, so we poll every minute while any match is in its window.
const postWindowMs = (stage: Match["stage"]) => (stage === "group" ? 180 : 240) * MINUTE_MS;

function isInPlayWindow(match: Match, now: number): boolean {
  const kickoff = new Date(match.kickoffAt).getTime();
  return now >= kickoff - PRE_KICKOFF_MS && now <= kickoff + postWindowMs(match.stage);
}

const minuteKey = (date: string | Date) => new Date(date).toISOString().slice(0, 16);

// ESPN names that don't match our team names exactly (codes are mapped first).
const ESPN_ALIASES: Record<string, string> = {
  "congo dr": "COD", "dr congo": "COD",
  "korea republic": "KOR", "south korea": "KOR",
  "ivory coast": "CIV", "côte d'ivoire": "CIV", "cote d'ivoire": "CIV",
  "cape verde": "CPV", "cape verde islands": "CPV",
  czechia: "CZE", "czech republic": "CZE",
  usa: "USA", "united states": "USA",
  iran: "IRN", "ir iran": "IRN",
  "curaçao": "CUW", curacao: "CUW",
  "bosnia and herzegovina": "BIH", "bosnia & herzegovina": "BIH",
};

function nameToCode(): Map<string, string> {
  const map = new Map<string, string>();
  for (const team of Object.values(TEAMS)) map.set(team.name.toLowerCase(), team.code);
  for (const [name, code] of Object.entries(ESPN_ALIASES)) map.set(name, code);
  return map;
}

type EspnCompetitor = {
  homeAway: "home" | "away";
  score?: string;
  team?: { abbreviation?: string; displayName?: string; name?: string };
};
type EspnEvent = {
  date: string;
  competitions?: {
    status?: { type?: { state?: string } };
    competitors?: EspnCompetitor[];
    venue?: { address?: { city?: string } };
  }[];
};

// ESPN team → our code: a recognised abbreviation wins, else the name lookup.
function teamCode(comp: EspnCompetitor | undefined, byName: Map<string, string>): string | null {
  if (!comp?.team) return null;
  const abbr = comp.team.abbreviation?.trim();
  if (abbr && TEAMS[abbr]) return abbr;
  const name = (comp.team.displayName ?? comp.team.name ?? "").trim().toLowerCase();
  return byName.get(name) ?? abbr ?? null;
}

export type LiveSyncResult = { polled: boolean; live: number; updated: number };

export async function syncLiveScores(): Promise<LiveSyncResult> {
  const all = await db.select().from(matches);
  const now = Date.now();
  // Only call ESPN while a match could be in progress.
  if (!all.some((match) => isInPlayWindow(match, now))) {
    return { polled: false, live: 0, updated: 0 };
  }

  const res = await fetch(ESPN_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { events?: EspnEvent[] };

  const byName = nameToCode();
  const byMinute = new Map<string, Match[]>();
  for (const match of all) {
    const key = minuteKey(match.kickoffAt);
    (byMinute.get(key) ?? byMinute.set(key, []).get(key)!).push(match);
  }

  let live = 0;
  let updated = 0;
  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0];
    const competitors = comp?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!comp || !home || !away) continue;

    // Match the ESPN event to our row by kickoff minute (home team disambiguates
    // simultaneous kickoffs).
    let candidates = byMinute.get(minuteKey(event.date)) ?? [];
    if (candidates.length > 1) {
      const homeCode = teamCode(home, byName);
      candidates = candidates.filter((m) => m.homeTeam === homeCode);
    }
    const match = candidates[0];
    if (!match) continue;

    // Capture the venue for free if we don't have it (ESPN gives "City, State").
    if (!match.venue) {
      const city = (comp.venue?.address?.city ?? "").split(",")[0]?.trim() ?? "";
      const label = venueLabel(city);
      if (label) await setMatchVenueIfMissing(match.id, label);
    }

    // Only in-progress matches; "post"/"pre" are left to football-data.
    if (comp.status?.type?.state !== "in") continue;
    const h = Number(home.score);
    const a = Number(away.score);
    if (!Number.isFinite(h) || !Number.isFinite(a)) continue;
    live += 1;
    await applyLiveScore(match.id, h, a);
    updated += 1;
  }

  return { polled: true, live, updated };
}
