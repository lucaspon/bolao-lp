import { db } from "./db/client";
import { matches, type Match } from "./db/schema";
import { applyLiveScore, setMatchVenueIfMissing } from "./db/queries";
import { TEAMS } from "./teams";
import { venueLabel } from "./venues";

// football-data's free tier doesn't report live/in-play scores, so we overlay
// them from API-Football's `fixtures?live=all` (which IS available on the free
// plan — only per-season queries are gated). football-data stays the source of
// truth for the schedule and final results; this only fills in live scores.

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1; // FIFA World Cup in API-Football

// API-Football's free plan allows 100 requests/day. To get the highest refresh
// rate the quota allows, we spend up to DAILY_BUDGET calls on the day's in-play
// minutes, distributed as evenly as possible:
//   • the cron fires every CRON_STEP_MIN (see vercel.json — keep them in sync);
//   • we list every cron tick at which a match is in play today;
//   • if that count fits the budget, we poll every tick (max refresh, 2 min);
//   • otherwise we evenly select exactly DAILY_BUDGET of those ticks, so the
//     refresh rate is as fine as the quota permits and never exceeds it.
const CRON_STEP_MIN = 2;
const DAILY_BUDGET = 95; // the 100/day hard cap, with a little jitter headroom
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
const gridMinute = (now: number) =>
  Math.floor((now - startOfUtcDay(now)) / MINUTE_MS / CRON_STEP_MIN) * CRON_STEP_MIN;

// Every cron tick (minute-of-day) at which at least one match is in play today.
function liveTicksToday(all: Match[], now: number): number[] {
  const dayStart = startOfUtcDay(now);
  const windows = all.map((match) => {
    const kickoff = new Date(match.kickoffAt).getTime();
    return [kickoff - PRE_KICKOFF_MIN * MINUTE_MS, kickoff + postWindowMs(match.stage)] as const;
  });
  const ticks: number[] = [];
  for (let minute = 0; minute < 1440; minute += CRON_STEP_MIN) {
    const t = dayStart + minute * MINUTE_MS;
    if (windows.some(([start, end]) => t >= start && t <= end)) ticks.push(minute);
  }
  return ticks;
}

// Should this tick spend an API call? If the day's in-play ticks fit the budget,
// poll them all. Otherwise evenly select exactly DAILY_BUDGET of them: tick at
// index `i` is chosen when it maps to a new budget slot (a Bresenham spread), so
// the chosen ticks are distributed as uniformly as the budget allows.
function shouldPoll(ticks: number[], minute: number): boolean {
  const count = ticks.length;
  if (count === 0) return false;
  if (count <= DAILY_BUDGET) return true;
  const i = ticks.indexOf(minute);
  if (i === -1) return true; // off-grid (cron jitter) but in play — don't skip it
  return (
    Math.floor((i * DAILY_BUDGET) / count) !== Math.floor(((i - 1) * DAILY_BUDGET) / count)
  );
}

// Approximate average minutes between calls, for logging/observability.
function effectiveIntervalMin(ticks: number[]): number {
  const calls = Math.min(ticks.length, DAILY_BUDGET);
  return calls > 0 ? Math.round((ticks.length * CRON_STEP_MIN) / calls) : CRON_STEP_MIN;
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

export function teamCodeByName(): Map<string, string> {
  const map = new Map<string, string>();
  for (const team of Object.values(TEAMS)) map.set(team.name.toLowerCase(), team.code);
  for (const [name, code] of Object.entries(NAME_ALIASES)) map.set(name, code);
  return map;
}

export const minuteKey = (date: Date | string | number) =>
  new Date(date).toISOString().slice(0, 16);

export const WC_LEAGUE = WC_LEAGUE_ID;
export const API_FOOTBALL_BASE = API_BASE;

// One API-Football fixture (live feed or date query). `venue` is present on both.
export type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string }; venue?: { name?: string | null; city?: string | null } };
  league: { id: number };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
};

// Finds the DB match a fixture refers to: primarily by kickoff minute, with the
// home-team code disambiguating simultaneous kickoffs (the final group round).
export function resolveDbMatch(
  fixture: ApiFixture,
  byMinute: Map<string, Match[]>,
  codeOf: Map<string, string>,
): Match | undefined {
  let candidates = byMinute.get(minuteKey(fixture.fixture.date)) ?? [];
  if (candidates.length > 1) {
    const homeCode = codeOf.get(fixture.teams.home.name.trim().toLowerCase());
    candidates = candidates.filter((m) => m.homeTeam === homeCode);
  }
  return candidates[0];
}

// Indexes matches by kickoff-minute for resolveDbMatch.
export function indexByMinute(all: Match[]): Map<string, Match[]> {
  const byMinute = new Map<string, Match[]>();
  for (const match of all) {
    const slot = minuteKey(match.kickoffAt);
    (byMinute.get(slot) ?? byMinute.set(slot, []).get(slot)!).push(match);
  }
  return byMinute;
}

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

  // Quota guard 2: spend a call only on the evenly-selected ticks, so the day's
  // total stays within budget while keeping the refresh rate as high as it fits.
  const ticks = liveTicksToday(all, now);
  const intervalMin = effectiveIntervalMin(ticks);
  if (!shouldPoll(ticks, gridMinute(now))) {
    return { polled: false, live: 0, updated: 0, intervalMin, throttled: true };
  }

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set.");

  const res = await fetch(`${API_BASE}/fixtures?live=all`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { response?: ApiFixture[] };
  const wc = (data.response ?? []).filter((f) => f?.league?.id === WC_LEAGUE_ID);

  const codeOf = teamCodeByName();
  const byMinute = indexByMinute(all);

  let updated = 0;
  for (const fixture of wc) {
    const match = resolveDbMatch(fixture, byMinute, codeOf);
    if (!match) {
      console.warn(
        `live: no DB match for ${fixture.teams.home.name}–${fixture.teams.away.name} @ ${fixture.fixture.date}`,
      );
      continue;
    }
    // Capture the venue for free from the live feed (fixed for the tournament).
    if (!match.venue) {
      const label = venueLabel(fixture.fixture.venue?.city);
      if (label) await setMatchVenueIfMissing(match.id, label);
    }
    const { home, away } = fixture.goals;
    if (home == null || away == null) continue;
    await applyLiveScore(match.id, home, away);
    updated += 1;
  }

  return { polled: true, live: wc.length, updated, intervalMin };
}
