import { requireUser } from "@/lib/auth/session";
import {
  getLeaderboard,
  getConcludedMatchCount,
  getLiveMatchCount,
  getPotTotalCents,
  getRecentResults,
  getScoredBetsByUser,
  getTopPlayersProgression,
} from "@/lib/db/queries";
import { LeaderboardView } from "@/components/leaderboard-view";
import { ResultsFeed } from "@/components/results-feed";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const me = await requireUser();
  const [rows, concluded, liveCount, potCents, results, scoredBets, progression] =
    await Promise.all([
      getLeaderboard(),
      getConcludedMatchCount(),
      getLiveMatchCount(),
      getPotTotalCents(),
      getRecentResults(),
      getScoredBetsByUser(),
      getTopPlayersProgression(),
    ]);

  return (
    <div className="w-full">
      <div className="grid items-start md:gap-18 lg:gap-24 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeaderboardView
            rows={rows}
            meId={me.id}
            concluded={concluded}
            liveCount={liveCount}
            potCents={potCents}
            scoredBets={scoredBets}
            progression={progression}
          />
        </div>
        <ResultsFeed items={results} meId={me.id} />
      </div>
    </div>
  );
}
