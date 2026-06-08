import { requireUser } from "@/lib/auth/session";
import {
  getLeaderboard,
  getConcludedMatchCount,
  getLiveMatchCount,
  getPotTotalCents,
} from "@/lib/db/queries";
import { LeaderboardView } from "@/components/leaderboard-view";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const me = await requireUser();
  const [rows, concluded, liveCount, potCents] = await Promise.all([
    getLeaderboard(),
    getConcludedMatchCount(),
    getLiveMatchCount(),
    getPotTotalCents(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <LeaderboardView
        rows={rows}
        meId={me.id}
        concluded={concluded}
        liveCount={liveCount}
        potCents={potCents}
      />
    </div>
  );
}
