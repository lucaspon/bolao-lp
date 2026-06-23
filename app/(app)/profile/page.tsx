import { headers } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import {
  getMatchesForUser,
  getUserStakeCents,
  getStakingBounds,
  getOrCreateApiToken,
} from "@/lib/db/queries";
import { MyBets } from "@/components/my-bets";
import { PayEntry } from "@/components/pay-entry";
import { ApiAccess } from "@/components/api-access";
import { scoreBet } from "@/lib/scoring";
import { stakingWindow } from "@/lib/staking";

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
  const [all, stakeCents, bounds, apiToken, headerList] = await Promise.all([
    getMatchesForUser(user.id),
    getUserStakeCents(user.id),
    getStakingBounds(),
    getOrCreateApiToken(user.id),
    headers(),
  ]);
  const baseUrl = `${headerList.get("x-forwarded-proto") ?? "https"}://${headerList.get("host")}`;
  const myPicks = all.filter((match) => match.bet);
  const window = stakingWindow(bounds);

  // exact/winner come from the actual scores (multiplier-independent), not the
  // weighted points value.
  const base = (match: (typeof myPicks)[number]) =>
    match.bet && match.homeScore !== null && match.awayScore !== null
      ? scoreBet(match.bet.homePred, match.bet.awayPred, match.homeScore, match.awayScore)
      : null;

  const scored = myPicks.filter((match) => base(match) !== null);
  const exact = myPicks.filter((match) => base(match) === 3).length;
  const correct = myPicks.filter((match) => base(match) === 1).length;
  const points = myPicks.reduce((sum, match) => sum + (match.bet?.points ?? 0), 0);
  const accuracy =
    scored.length > 0 ? Math.round(((exact + correct) / scored.length) * 100) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 font-display text-2xl font-bold tracking-wide">Minhas Apostas</h1>
      <p className="mb-5 text-sm text-mute">Conectado como @{user.username}</p>

      <div className="mb-6">
        <PayEntry
          stakeCents={stakeCents}
          phase={window.phase}
          open={window.open}
          topUpOnly={window.topUpOnly}
          firstTimeOnly={window.firstTimeOnly}
        />
      </div>

      <div className="mb-7 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <Stat value={points} label="pontos" />
        <Stat value={myPicks.length} label="palpites" />
        <Stat value={exact} label="cravadas" />
        <Stat value={correct} label="resultados" />
        <Stat value={accuracy === null ? "–" : `${accuracy}%`} label="precisão" />
      </div>

      <div className="mb-7">
        <ApiAccess token={apiToken} baseUrl={baseUrl} />
      </div>

      {myPicks.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-mute">
          Você ainda não fez nenhum palpite.{" "}
          <a href="/matches" className="text-neon hover:underline">
            Ir para os jogos →
          </a>
        </p>
      ) : (
        <MyBets picks={myPicks} />
      )}
    </div>
  );
}
