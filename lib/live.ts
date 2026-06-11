import { db } from "./db/client";
import { matches, type Match } from "./db/schema";
import { applyLiveScore } from "./db/queries";
import { TEAMS } from "./teams";

// football-data's free tier doesn't report live/in-play scores, so we overlay
// them from API-Football's `fixtures?live=all` (which IS available on the free
// plan — only per-season queries are gated). football-data stays the source of
// truth for the schedule and final results; this only fills in live scores.

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1; // FIFA World Cup in API-Football
// Only call the API while a match is plausibly in progress, to stay within the
// free plan's 100 requests/day (kickoff + 2h match + ET/pens + buffer).
const WINDOW_AFTER_KICKOFF_MS = 3.5 * 60 * 60 * 1000;
const WINDOW_BEFORE_KICKOFF_MS = 10 * 60 * 1000;

// API-Football team names that don't exactly match our TEAMS.name. Used only to
// disambiguate simultaneous matches (the final group round); the primary match
// is by kickoff time.
const NAME_ALIASES: Record<string, string> = {
  "korea republic": "KOR",
  usa: "USA",
  "united states of america": "USA",
  "ivory coast": "CIV",
  "côte d'ivoire": "CIV",
  "cote d'ivoire": "CIV",
  "ir iran": "IRN",
  "czech republic": "CZE",
  "cape verde islands": "CPV",
  curacao: "CUW",
  "dr congo": "COD",
  "congo dr": "COD",
  "bosnia and herzegovina": "BIH",
};

function teamCodeByName(): Map<string, string> {
  const map = new Map<string, string>();
  for (const team of Object.values(TEAMS)) map.set(team.name.toLowerCase(), team.code);
  for (const [name, code] of Object.entries(NAME_ALIASES)) map.set(name, code);
  return map;
}

const minuteKey = (date: Date | string | number) => new Date(date).toISOString().slice(0, 16);

type LiveFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  league: { id: number };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
};

export type LiveSyncResult = { polled: boolean; live: number; updated: number };

export async function syncLiveScores(): Promise<LiveSyncResult> {
  const all = await db.select().from(matches);
  const now = Date.now();

  // Quota guard: skip the API entirely unless a match could be live right now.
  const anyInWindow = all.some((match) => {
    const kickoff = new Date(match.kickoffAt).getTime();
    return kickoff > now - WINDOW_AFTER_KICKOFF_MS && kickoff < now + WINDOW_BEFORE_KICKOFF_MS;
  });
  if (!anyInWindow) return { polled: false, live: 0, updated: 0 };

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set.");

  const res = await fetch(`${API_BASE}/fixtures?live=all`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { response?: LiveFixture[] };
  const wc = (data.response ?? []).filter((f) => f?.league?.id === WC_LEAGUE_ID);

  const codeOf = teamCodeByName();
  const byMinute = new Map<string, Match[]>();
  for (const match of all) {
    const slot = minuteKey(match.kickoffAt);
    (byMinute.get(slot) ?? byMinute.set(slot, []).get(slot)!).push(match);
  }

  let updated = 0;
  for (const fixture of wc) {
    const { home, away } = fixture.goals;
    if (home == null || away == null) continue;

    let candidates = byMinute.get(minuteKey(fixture.fixture.date)) ?? [];
    if (candidates.length > 1) {
      const homeCode = codeOf.get(fixture.teams.home.name.trim().toLowerCase());
      candidates = candidates.filter((m) => m.homeTeam === homeCode);
    }
    const match = candidates[0];
    if (!match) {
      console.warn(
        `live: no DB match for ${fixture.teams.home.name}–${fixture.teams.away.name} @ ${fixture.fixture.date}`,
      );
      continue;
    }
    await applyLiveScore(match.id, home, away);
    updated += 1;
  }

  return { polled: true, live: wc.length, updated };
}
