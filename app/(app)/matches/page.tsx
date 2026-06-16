import { requireUser } from "@/lib/auth/session";
import { getMatchesForUser, type MatchWithBet } from "@/lib/db/queries";
import { canBet, isLockedAt, isClosingSoon, pointsElapsedPct } from "@/lib/match";
import { stakingWindow } from "@/lib/staking";
import { BetDeadlineCallout } from "@/components/bet-deadline-callout";
import { GROUP_LABELS } from "@/lib/teams";
import { BRACKET, matchNoForApiId, slotShortLabel } from "@/lib/bracket";
import { formatPillKickoff } from "@/lib/format";
import { MatchPill, type PillMatch } from "@/components/match-pill";
import { BracketView, type BracketPill } from "@/components/bracket-view";
import { StageTabs, type StagePanel } from "@/components/stage-tabs";
import { KeyboardBetProvider } from "@/components/keyboard-bet";

export const dynamic = "force-dynamic";

function toPill(match: MatchWithBet): PillMatch {
  const kickoffMs = new Date(match.kickoffAt).getTime();
  return {
    id: match.id,
    kickoffMs,
    initialLocked: isLockedAt(kickoffMs),
    initialClosingSoon: isClosingSoon(kickoffMs),
    status: match.status,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homePlaceholder: match.homePlaceholder,
    awayPlaceholder: match.awayPlaceholder,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    bet: match.bet,
    dateLabel: formatPillKickoff(match.kickoffAt),
    venue: match.venue,
  };
}

// Group stage as a wall of columns — up to 6 across (two rows of groups),
// fewer on smaller screens. One column per group, pills stacked inside.
function GroupStage({ matches }: { matches: MatchWithBet[] }) {
  return (
    <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {GROUP_LABELS.map((label) => {
        const list = matches.filter((match) => match.groupLabel === label);
        if (list.length === 0) return null;
        return (
          <div key={label} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-1 px-0.5">
              <span className="font-display font-bold text-neon">
                {label}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-mute">
                Group
              </span>
            </div>
            {list.map((match, index) => (
              <MatchPill
                key={match.id}
                match={toPill(match)}
                className={index > 0 && index % 2 === 0 ? "mt-0" : undefined}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Enriches each knockout match with its FIFA match number and the group-slot /
// feeder label to show until the real team is decided.
function toBracketPills(matches: MatchWithBet[]): BracketPill[] {
  return matches.flatMap((match) => {
    const matchNo = matchNoForApiId(match.apiMatchId);
    if (matchNo == null) return [];
    const spec = BRACKET[matchNo];
    return [
      {
        ...toPill(match),
        matchNo,
        homePlaceholder: slotShortLabel(spec.home),
        awayPlaceholder: slotShortLabel(spec.away),
      },
    ];
  });
}

// Weighted tournament progress: how much of the total points pool has already
// been decided (assuming Brazil reaches the final). Climbs slowly through the
// group stage and jumps in the heavily-weighted knockouts.
function PointsElapsed({ pct }: { pct: number }) {
  const rounded = Math.round(pct);
  return (
    <div className="mb-4 rounded-xl border border-line bg-panel px-4 py-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs text-mute">
          Pontos do torneio já decididos{" "}
          <span className="text-mute/60">(estimado, Brasil até a final)</span>
        </span>
        <span className="tabular font-display text-sm font-bold text-neon">{rounded}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-base">
        <div
          className="h-full rounded-full bg-neon transition-all"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function StatChip({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5">
      <span className="tabular font-display text-lg font-bold text-neon">
        {value}
      </span>
      <span className="text-xs text-mute">{label}</span>
    </div>
  );
}

// Only during the top-up staking window (between the last group match and the
// first knockout) do we surface a callout — it returns when that window closes
// (the knockouts begin). Null otherwise, so the callout stays hidden.
function topupDeadlineMs(matches: MatchWithBet[]): number | null {
  const toMs = (list: MatchWithBet[]) => list.map((m) => new Date(m.kickoffAt).getTime());
  const group = toMs(matches.filter((m) => m.stage === "group"));
  const r32 = toMs(matches.filter((m) => m.stage === "round_of_32"));
  if (group.length === 0 || r32.length === 0) return null;
  const bounds = {
    firstGroupMs: Math.min(...group),
    lastGroupMs: Math.max(...group),
    firstKnockoutMs: Math.min(...r32),
  };
  return stakingWindow(bounds).phase === "topup" ? bounds.firstKnockoutMs : null;
}

export default async function MatchesPage() {
  const user = await requireUser();
  const matches = await getMatchesForUser(user.id);

  const picks = matches.filter((match) => match.bet).length;
  const openNow = matches.filter((match) => canBet(match)).length;
  const points = matches.reduce(
    (sum, match) => sum + (match.bet?.points ?? 0),
    0,
  );
  const elapsedPct = pointsElapsedPct(matches);

  const groupMatches = matches.filter((match) => match.stage === "group");
  const knockoutPills = toBracketPills(matches.filter((match) => match.stage !== "group"));

  const topupCloses = topupDeadlineMs(matches);

  const panels: StagePanel[] = [
    {
      key: "group",
      short: "Grupos",
      count: groupMatches.length,
      node: <GroupStage matches={groupMatches} />,
    },
    {
      key: "knockout",
      short: "Mata-mata",
      count: knockoutPills.length,
      node: <BracketView matches={knockoutPills} />,
    },
  ].filter((panel) => panel.count > 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wide">
            Olá, {user.username} 👋
          </h1>
          <p className="text-sm text-mute">
            Toque no placar para palpitar. +3 cravando, +1 acertando o resultado.
            Fecha 10 min antes do jogo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatChip value={points} label="pts" />
          <StatChip value={picks} label="palpites" />
          <StatChip value={openNow} label="abertos" />
        </div>
      </div>

      <PointsElapsed pct={elapsedPct} />

      {topupCloses && <BetDeadlineCallout deadlineMs={topupCloses} />}

      <p className="mb-3 text-xs text-mute">
        ⌨️ Setas movem · <span className="text-ink">Enter</span> para apostar ·{" "}
        <span className="text-ink">↑↓</span> ou{" "}
        <span className="text-ink">0–9</span> definem o placar ·{" "}
        <span className="text-ink">←→</span> lado ·{" "}
        <span className="text-ink">Del</span> limpa ·{" "}
        <span className="text-ink">Enter</span> salva ·{" "}
        <span className="text-ink">Tab</span> troca a fase
      </p>

      <KeyboardBetProvider>
        <StageTabs panels={panels} />
      </KeyboardBetProvider>
    </div>
  );
}
