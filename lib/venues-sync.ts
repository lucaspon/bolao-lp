import { db } from "./db/client";
import { matches, type Match } from "./db/schema";
import { setMatchVenueIfMissing } from "./db/queries";
import { venueLabel } from "./venues";
import {
  API_FOOTBALL_BASE,
  WC_LEAGUE,
  teamCodeByName,
  indexByMinute,
  resolveDbMatch,
  type ApiFixture,
} from "./live";

// API-Football's free tier only exposes WC fixtures in a near-term window, so we
// fill venues progressively: each run queries the next few dates that still have
// venue-less matches and within reach of the API. Venue is fixed per match, so a
// match is queried at most once. Capped so the live poller keeps its full quota.
const MAX_DATES_PER_RUN = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 2; // a match may have just been played
const LOOKAHEAD_DAYS = 6; // the API's free near-term window

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export type VenueSyncResult = { datesQueried: number; updated: number };

export async function syncVenues(): Promise<VenueSyncResult> {
  const all = await db.select().from(matches);
  const now = Date.now();
  const windowStart = now - LOOKBACK_DAYS * DAY_MS;
  const windowEnd = now + LOOKAHEAD_DAYS * DAY_MS;

  // Distinct dates of venue-less matches that the API can plausibly answer for.
  const dates = [
    ...new Set(
      all
        .filter((match) => !match.venue)
        .map((match) => new Date(match.kickoffAt).getTime())
        .filter((ms) => ms >= windowStart && ms <= windowEnd)
        .map(dayKey),
    ),
  ]
    .sort()
    .slice(0, MAX_DATES_PER_RUN);

  if (dates.length === 0) return { datesQueried: 0, updated: 0 };

  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set.");

  const codeOf = teamCodeByName();
  const byMinute = indexByMinute(all);
  let updated = 0;

  for (const date of dates) {
    const res = await fetch(`${API_FOOTBALL_BASE}/fixtures?date=${date}`, {
      headers: { "x-apisports-key": key },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API-Football ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { response?: ApiFixture[] };
    const wc = (data.response ?? []).filter((f) => f?.league?.id === WC_LEAGUE);

    for (const fixture of wc) {
      const match = resolveDbMatch(fixture, byMinute, codeOf);
      if (!match) continue;
      const label = venueLabel(fixture.fixture.venue?.city);
      if (label) updated += await setMatchVenueIfMissing(match.id, label);
    }
  }

  return { datesQueried: dates.length, updated };
}
