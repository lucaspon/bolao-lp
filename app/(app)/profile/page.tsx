import { requireUser } from "@/lib/auth/session";
import { getMatchesForUser } from "@/lib/db/queries";
import { MatchCard } from "@/components/match-card";

export const dynamic = "force-dynamic";

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3 text-center">
      <div className="tabular font-display text-2xl font-bold text-neon">{value}</div>
      <div className="text-xs text-mute">{label}</div>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();
  const all = await getMatchesForUser(user.id);
  const myPicks = all.filter((match) => match.bet);

  const scored = myPicks.filter((match) => match.bet?.points !== null);
  const exact = myPicks.filter((match) => match.bet?.points === 3).length;
  const correct = myPicks.filter((match) => match.bet?.points === 1).length;
  const points = myPicks.reduce((sum, match) => sum + (match.bet?.points ?? 0), 0);
  const accuracy =
    scored.length > 0 ? Math.round(((exact + correct) / scored.length) * 100) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 font-display text-2xl font-bold tracking-wide">My Bets</h1>
      <p className="mb-5 text-sm text-mute">Signed in as @{user.username}</p>

      <div className="mb-7 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <Stat value={points} label="points" />
        <Stat value={myPicks.length} label="picks" />
        <Stat value={exact} label="exact" />
        <Stat value={correct} label="winners" />
        <Stat value={accuracy === null ? "–" : `${accuracy}%`} label="accuracy" />
      </div>

      {myPicks.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-mute">
          You have not placed any predictions yet.{" "}
          <a href="/matches" className="text-neon hover:underline">
            Head to the matches →
          </a>
        </p>
      ) : (
        <div className="grid gap-3">
          {myPicks.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
