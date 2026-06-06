import { db } from "./db/client";
import { matches, type Stage, type MatchStatus } from "./db/schema";
import { rescoreMatch } from "./db/queries";

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

    const values = {
      extId: `wc-${apiMatch.id}`,
      apiMatchId: apiMatch.id,
      stage,
      groupLabel: apiMatch.group ? apiMatch.group.replace("GROUP_", "") : null,
      homeTeam: apiMatch.homeTeam?.tla ?? null,
      awayTeam: apiMatch.awayTeam?.tla ?? null,
      kickoffAt: new Date(apiMatch.utcDate),
      status,
      homeScore,
      awayScore,
    };

    const [saved] = await db
      .insert(matches)
      .values(values)
      .onConflictDoUpdate({
        target: matches.apiMatchId,
        set: {
          stage: values.stage,
          groupLabel: values.groupLabel,
          homeTeam: values.homeTeam,
          awayTeam: values.awayTeam,
          kickoffAt: values.kickoffAt,
          status: values.status,
          homeScore: values.homeScore,
          awayScore: values.awayScore,
        },
      })
      .returning({ id: matches.id });

    result.total += 1;
    if (status === "live") result.live += 1;
    if (status === "finished") {
      result.finished += 1;
      if (homeScore !== null && awayScore !== null) {
        await rescoreMatch(saved.id, homeScore, awayScore);
        result.rescored += 1;
      }
    }
  }

  return result;
}
