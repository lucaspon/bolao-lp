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

// API-Football's free plan allows 100 requests/day. We poll adaptively to stay
// under that while updating as fast as the day's match load allows:
//   • the cron fires every CRON_STEP_MIN (see vercel.json — keep them in sync);
//   • we only spend a call while a match is plausibly in play;
//   • the interval between calls stretches on busy days so the total never
//     exceeds DAILY_BUDGET. Light days poll every 2 min; the heaviest group days
//     (many staggered matches) back off to a handful of minutes.
const CRON_STEP_MIN = 2;
const DAILY_BUDGET = 90; // headroom under the 100/day hard cap
const MAX_INTERVAL_MIN = 10;
const MINUTE_MS = 60 * 1000;
const PRE_KICKOFF_MIN = 2;
const POST_KICKOFF_GROUP_MIN = 140; // 90 + half-time + stoppage + buffer
const POST_KICKOFF_KO_MIN = 185; // group window + extra time + penalties

function postWindowMs(stage: Match["stage"]): number {
  return (stage === "group" ? POST_KICKOFF_GROUP_MIN : POST_KICKOFF_KO_MIN) * MINUTE_MS;
}

function isInPlayWindow(match: Match, now: number): boolean {
  const kickoff = new Date(match.kickoffAt).getTime();
  return now >= kickoff - PRE_KICKOFF_MIN * MINUTE_MS && now <= kickoff + postWindowMs(match.stage);
}

const startOfUtcDay = (now: number) => Math.floor(now / 86_400_000) * 86_400_000;

// The poll interval (minutes, a multiple of the cron step) that keeps today's
// total calls under budget: total in-play minutes today ÷ interval ≤ budget.
// Overlapping (simultaneous) matches share one `live=all` call, so we count the
// UNION of their in-play windows, not the sum.
function pollIntervalMin(all: Match[], now: number): number {
  const dayStart = startOfUtcDay(now);
  const dayEnd = dayStart + 86_400_000;
  const windows = all
    .map((match) => {
      const kickoff = new Date(match.kickoffAt).getTime();
      return [kickoff - PRE_KICKOFF_MIN * MINUTE_MS, kickoff + postWindowMs(match.stage)] as const;
    })
    .filter(([start, end]) => end > dayStart && start < dayEnd)
    .map(([start, end]) => [Math.max(start, dayStart), Math.min(end, dayEnd)] as const)
    .sort((a, b) => a[0] - b[0]);

  let unionMs = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [start, end] of windows) {
    if (start > curEnd) {
      unionMs += Math.max(0, curEnd - curStart);
      curStart = start;
      curEnd = end;
    } else {
      curEnd = Math.max(curEnd, end);
    }
  }
  unionMs += Math.max(0, curEnd - curStart);

  const inPlayMinutes = unionMs / MINUTE_MS;
  const ideal = Math.ceil(inPlayMinutes / DAILY_BUDGET);
  const stepped = Math.ceil(ideal / CRON_STEP_MIN) * CRON_STEP_MIN;
  return Math.min(Math.max(stepped, CRON_STEP_MIN), MAX_INTERVAL_MIN);
}

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

export type LiveSyncResult = {
  polled: boolean;
  live: number;
  updated: number;
  intervalMin?: number;
  throttled?: boolean;
};

export async function syncLiveScores(): Promise<LiveSyncResult> {
  const all = await db.select().from(matches);
  const now = Date.now();

  // Quota guard 1: skip the API entirely unless a match could be live right now.
  if (!all.some((match) => isInPlayWindow(match, now))) {
    return { polled: false, live: 0, updated: 0 };
  }

  // Quota guard 2: only spend a call on this tick's spacing boundary, so the
  // day's total calls stay under budget even on heavy match days.
  const intervalMin = pollIntervalMin(all, now);
  const minuteOfDay = Math.floor((now - startOfUtcDay(now)) / MINUTE_MS);
  if (minuteOfDay % intervalMin >= CRON_STEP_MIN) {
    return { polled: false, live: 0, updated: 0, intervalMin, throttled: true };
  }

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

  return { polled: true, live: wc.length, updated, intervalMin };
}
