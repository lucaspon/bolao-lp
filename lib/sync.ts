import { sql } from "drizzle-orm";
import { db } from "./db/client";
import { matches, type Stage, type MatchStatus } from "./db/schema";
import { rescoreMatch, hasUnscoredBets } from "./db/queries";
import { matchPointsMultiplier } from "./match";

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
  if (apiStatus === "IN_PLAY" || apiStatus === "PAUSED") return "live";
  if (apiStatus === "FINISHED" || apiStatus === "AWARDED") return "finished";
  return "scheduled";
}

type ApiTeam = { tla: string | null; name: string | null };
type ApiMatch = {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: { fullTime: { home: number | null; away: number | null } };
};

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

// Pulls the World Cup schedule + results from football-data.org and upserts them
// (the API is our source of truth). Finished matches get re-scored.
export async function syncMatches(): Promise<SyncResult> {
  const apiMatches = await fetchWcMatches();
  const result: SyncResult = { total: 0, live: 0, finished: 0, rescored: 0 };

  for (const apiMatch of apiMatches) {
    const stage = STAGE_MAP[apiMatch.stage];
    if (!stage) continue;

    const status = mapStatus(apiMatch.status);
    const { home, away } = apiMatch.score.fullTime;
    const hasScore = home !== null && away !== null;
    const homeScore = status === "scheduled" || !hasScore ? null : home;
    const awayScore = status === "scheduled" || !hasScore ? null : away;
    // `?? null` isn't enough: football-data can return an empty-string tla, which
    // would (being non-null) clobber a known team. Treat blank as null.
    const homeTeam = apiMatch.homeTeam?.tla?.trim() || null;
    const awayTeam = apiMatch.awayTeam?.tla?.trim() || null;

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
      });

    result.total += 1;
    if (saved.status === "live") result.live += 1;
    // Rescore from the STORED score/status (post-merge), not this feed response —
    // a finished match's score may have come from the live overlay while
    // football-data's "finished" payload still has a null score. Without this,
    // bets stay unscored and the official leaderboard reads 0.
    if (saved.status === "finished" && saved.homeScore !== null && saved.awayScore !== null) {
      result.finished += 1;
      const freshScore = status === "finished" && homeScore !== null && awayScore !== null;
      if (freshScore || (await hasUnscoredBets(saved.id))) {
        await rescoreMatch(saved.id, saved.homeScore, saved.awayScore);
        result.rescored += 1;
      }
    }
  }

  return result;
}
