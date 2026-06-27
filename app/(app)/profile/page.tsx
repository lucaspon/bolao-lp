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
import { BetDeadlineCallout } from "@/components/bet-deadline-callout";
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
  const callout =
    window.phase === "topup"
      ? { deadlineMs: bounds.firstKnockoutMs, opens: false }
      : window.phase === "group_running"
        ? { deadlineMs: bounds.lastGroupMs, opens: true }
        : null;

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
    <div className="w-full">
      {callout && <BetDeadlineCallout deadlineMs={callout.deadlineMs} opens={callout.opens} />}

      {/* Header + stats on one row; payment and API side-by-side. Everything
          uses the full width but is split into columns so nothing is stretched. */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">Minhas Apostas</h1>
          <p className="text-sm text-mute">Conectado como @{user.username}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <Stat value={points} label="pontos" />
          <Stat value={myPicks.length} label="palpites" />
          <Stat value={exact} label="cravadas" />
          <Stat value={correct} label="resultados" />
          <Stat value={accuracy === null ? "–" : `${accuracy}%`} label="precisão" />
        </div>
      </div>

      <div className="mb-6 grid items-start gap-4 lg:grid-cols-2">
        <PayEntry
          stakeCents={stakeCents}
          phase={window.phase}
          open={window.open}
          topUpOnly={window.topUpOnly}
          firstTimeOnly={window.firstTimeOnly}
        />
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
