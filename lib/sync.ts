import { sql } from "drizzle-orm";
import { db } from "./db/client";
import { matches, type Stage, type MatchStatus } from "./db/schema";
import { rescoreMatch, getUnscoredMatchIds } from "./db/queries";
import { matchPointsMultiplier } from "./match";
import { TEAMS } from "./teams";

// Lower-case + strip diacritics so "Curaçao" and "Curacao" compare equal.
function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Reverse map: normalized team name → our canonical code. Used to recover the
// right code when the feed sends a tla we don't recognise but a name we do.
const TEAM_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.values(TEAMS).map((t) => [normalizeName(t.name), t.code]),
);

const API_BASE = "https://api.football-data.org/v4";
const COMPETITION = "WC"; // FIFA World Cup

const STAGE_MAP: Record<string, Stage> = {
  GROUP_STAGE: "group",
  LAST_32: "round_of_32",
  LAST_16: "round_of_16",
  QUARTER_FINALS: "quarter",
  SEMI_FINALS: "semi",
  THIRD_PLACE: "third_place",
  FINAL: "final",
};

function mapStatus(apiStatus: string): MatchStatus {
  // football-data uses several in-progress labels (it has returned plain "LIVE"
  // as well as IN_PLAY/PAUSED/SUSPENDED) — treat them all as live.
  if (["IN_PLAY", "PAUSED", "LIVE", "SUSPENDED"].includes(apiStatus)) return "live";
  if (apiStatus === "FINISHED" || apiStatus === "AWARDED") return "finished";
  return "scheduled";
}

type ApiTeam = { tla: string | null; name: string | null };

// Resolve the API's team to one of OUR canonical codes (the keys of TEAMS).
// Priority: a tla we recognise → name lookup → the raw tla as a last resort →
// null. The name fallback fixes the feed sending a tla we don't know (e.g.
// "CUR" for Curaçao, whose canonical code is "CUW") alongside a name we do.
function resolveTeamCode(apiTeam: ApiTeam | null | undefined): string | null {
  const tla = apiTeam?.tla?.trim() || null;
  if (tla && TEAMS[tla]) return tla;
  const name = apiTeam?.name?.trim();
  if (name) {
    const byName = TEAM_NAME_TO_CODE[normalizeName(name)];
    if (byName) return byName;
  }
  return tla; // unknown code but no name match — keep it rather than nulling
}
type ApiScore = {
  duration: string;
  fullTime: { home: number | null; away: number | null };
  penalties: { home: number | null; away: number | null } | null;
};
type ApiMatch = {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: ApiScore;
};

// The score we grade bets on: extra time counts, the penalty shootout doesn't.
// football-data's fullTime is the cumulative running score and rolls the
// shootout in (e.g. a 1–1 won 6–5 on pens is reported as 7–6), so when a match
// went to penalties we subtract them back out — grading it as the draw it was
// at the end of extra time.
function exPenaltiesScore(score: ApiScore): { home: number | null; away: number | null } {
  const { home, away } = score.fullTime;
  if (score.duration !== "PENALTY_SHOOTOUT" || home === null || away === null) {
    return { home, away };
  }
  return {
    home: home - (score.penalties?.home ?? 0),
    away: away - (score.penalties?.away ?? 0),
  };
}

async function fetchWcMatches(): Promise<ApiMatch[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN is not set.");

  const response = await fetch(`${API_BASE}/competitions/${COMPETITION}/matches`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`football-data.org ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as { matches: ApiMatch[] };
  return data.matches;
}

export type SyncResult = { total: number; live: number; finished: number; rescored: number };

// Scores that the API has wrong and we've verified manually. Keyed by apiMatchId.
// These override whatever football-data.org returns and survive every sync run.
const SCORE_OVERRIDES: Record<number, { home: number; away: number }> = {
  537368: { home: 1, away: 1 }, // EGY 1-1 IRN (API incorrectly reports 1-2)
};

// Pulls the World Cup schedule + results from football-data.org and upserts them
// (the API is our source of truth). Finished matches get re-scored.
export async function syncMatches(): Promise<SyncResult> {
  const apiMatches = await fetchWcMatches();
  const now = Date.now();
  const result: SyncResult = { total: 0, live: 0, finished: 0, rescored: 0 };

  // Prefetch current scores + which matches have unscored bets, so we only
  // rescore a finished match when its score actually changed (or bets are still
  // unscored) — not every finished match every run, which timed the sync out.
  const existing = await db
    .select({
      apiMatchId: matches.apiMatchId,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
    })
    .from(matches);
  const oldByApiId = new Map(
    existing.map((m) => [m.apiMatchId, { homeScore: m.homeScore, awayScore: m.awayScore }]),
  );
  const unscoredMatchIds = await getUnscoredMatchIds();

  const processMatch = async (apiMatch: ApiMatch) => {
    const stage = STAGE_MAP[apiMatch.stage];
    if (!stage) return;

    const status = mapStatus(apiMatch.status);
    const override = SCORE_OVERRIDES[apiMatch.id];
    const { home, away } = override ?? exPenaltiesScore(apiMatch.score);
    const hasScore = home !== null && away !== null;
    const homeScore = status === "scheduled" || !hasScore ? null : home;
    const awayScore = status === "scheduled" || !hasScore ? null : away;
    // `?? null` isn't enough: football-data can return an empty-string tla. We
    // also fall back to the team name (resolves e.g. "Curaçao" → "CUW") when
    // tla is missing, so a blank tla never permanently erases a known team.
    const homeTeam = resolveTeamCode(apiMatch.homeTeam);
    const awayTeam = resolveTeamCode(apiMatch.awayTeam);

    const values = {
      extId: `wc-${apiMatch.id}`,
      apiMatchId: apiMatch.id,
      stage,
      groupLabel: apiMatch.group ? apiMatch.group.replace("GROUP_", "") : null,
      homeTeam,
      awayTeam,
      kickoffAt: new Date(apiMatch.utcDate),
      status,
      homeScore,
      awayScore,
      pointsMultiplier: matchPointsMultiplier(stage, homeTeam, awayTeam),
    };

    const [saved] = await db
      .insert(matches)
      .values(values)
      .onConflictDoUpdate({
        target: matches.apiMatchId,
        // Non-destructive merge: the football-data feed occasionally returns a
        // match with its teams/scores momentarily missing. We must never clobber
        // a value we already know with a transient null — teams only get decided,
        // scores only get set, and a finished match never un-finishes. So keep
        // the existing value when the incoming one is null, and don't let status
        // regress out of live/finished.
        set: {
          stage: values.stage,
          groupLabel: sql`coalesce(excluded.group_label, ${matches.groupLabel})`,
          homeTeam: sql`coalesce(nullif(excluded.home_team, ''), ${matches.homeTeam})`,
          awayTeam: sql`coalesce(nullif(excluded.away_team, ''), ${matches.awayTeam})`,
          kickoffAt: values.kickoffAt,
          status: sql`case
            when ${matches.status} = 'finished' then ${matches.status}
            when ${matches.status} = 'live' and excluded.status = 'scheduled' then ${matches.status}
            else excluded.status end`,
          homeScore: sql`coalesce(excluded.home_score, ${matches.homeScore})`,
          awayScore: sql`coalesce(excluded.away_score, ${matches.awayScore})`,
          pointsMultiplier: values.pointsMultiplier,
        },
      })
      .returning({
        id: matches.id,
        status: matches.status,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        kickoffAt: matches.kickoffAt,
      });

    result.total += 1;
    if (saved.status === "live") result.live += 1;
    // Finalization is driven solely by football-data's FINISHED status (applied
    // by the merge above), never by the clock — a clock rule wrongly finalizes a
    // rain-suspended match whose elapsed time exceeds 90'. The merge keeps the
    // score current (even while football-data still says IN_PLAY), so a finished
    // match shows the right score. Rescore when the score changed, bets are
    // still unscored, or the match finished very recently (≤10 min after kickoff
    // + typical match duration) — the re-sync window catches VAR reversals and
    // stoppage-time goals that land after football-data first marks it FINISHED.
    if (saved.status === "finished" && saved.homeScore !== null && saved.awayScore !== null) {
      result.finished += 1;
      const old = oldByApiId.get(apiMatch.id);
      const scoreChanged =
        !old || old.homeScore !== saved.homeScore || old.awayScore !== saved.awayScore;
      const stage = STAGE_MAP[apiMatch.stage];
      const typicalDurationMs = (stage === "group" ? 110 : 150) * 60_000;
      const resyncWindowMs = 10 * 60_000;
      const recentlyFinished =
        now - new Date(saved.kickoffAt).getTime() < typicalDurationMs + resyncWindowMs;
      if (scoreChanged || unscoredMatchIds.has(saved.id) || recentlyFinished) {
        await rescoreMatch(saved.id, saved.homeScore, saved.awayScore);
        result.rescored += 1;
      }
    }
  };

  // Upserts are independent rows, so run them concurrently in small batches —
  // the transaction pooler multiplexes (max:10), turning ~100 sequential
  // round-trips (which timed the function out) into a handful of parallel waves.
  const CONCURRENCY = 8;
  for (let i = 0; i < apiMatches.length; i += CONCURRENCY) {
    await Promise.all(apiMatches.slice(i, i + CONCURRENCY).map(processMatch));
  }

  return result;
}
