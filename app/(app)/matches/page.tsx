import { requireUser } from "@/lib/auth/session";
import { getMatchesForUser, type MatchWithBet } from "@/lib/db/queries";
import { STAGES, canBet, isLockedAt } from "@/lib/match";
import { GROUP_LABELS } from "@/lib/teams";
import { formatPillKickoff } from "@/lib/format";
import { MatchPill, type PillMatch } from "@/components/match-pill";
import { StageTabs, type StagePanel } from "@/components/stage-tabs";
import { KeyboardBetProvider } from "@/components/keyboard-bet";

export const dynamic = "force-dynamic";

function toPill(match: MatchWithBet): PillMatch {
  const kickoffMs = new Date(match.kickoffAt).getTime();
  return {
    id: match.id,
    kickoffMs,
    initialLocked: isLockedAt(kickoffMs),
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homePlaceholder: match.homePlaceholder,
    awayPlaceholder: match.awayPlaceholder,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    bet: match.bet,
    dateLabel: formatPillKickoff(match.kickoffAt),
  };
}

// Group stage as a wall of columns — up to 6 across (two rows of groups),
// fewer on smaller screens. One column per group, pills stacked inside.
function GroupStage({ matches }: { matches: MatchWithBet[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {GROUP_LABELS.map((label) => {
        const list = matches.filter((match) => match.groupLabel === label);
        if (list.length === 0) return null;
        return (
          <div key={label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-1 px-0.5">
              <span className="font-display text-base font-bold text-neon">
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

function KnockoutGrid({ matches }: { matches: MatchWithBet[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {matches.map((match) => (
        <MatchPill key={match.id} match={toPill(match)} />
      ))}
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

export default async function MatchesPage() {
  const user = await requireUser();
  const matches = await getMatchesForUser(user.id);

  const picks = matches.filter((match) => match.bet).length;
  const openNow = matches.filter((match) => canBet(match)).length;
  const points = matches.reduce(
    (sum, match) => sum + (match.bet?.points ?? 0),
    0,
  );

  const panels: StagePanel[] = STAGES.map((stage) => {
    const list = matches.filter((match) => match.stage === stage.key);
    return {
      key: stage.key,
      short: stage.short,
      count: list.length,
      node:
        stage.key === "group" ? (
          <GroupStage matches={list} />
        ) : (
          <KnockoutGrid matches={list} />
        ),
    };
  }).filter((panel) => panel.count > 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wide">
            Hey, {user.username} 👋
          </h1>
          <p className="text-sm text-mute">
            Tap a score to predict. +3 exact, +1 right result. Locks 1h before
            kickoff.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatChip value={points} label="pts" />
          <StatChip value={picks} label="picks" />
          <StatChip value={openNow} label="open" />
        </div>
      </div>

      <p className="mb-3 text-xs text-mute">
        ⌨️ Arrows move · <span className="text-ink">Enter</span> to bet ·{" "}
        <span className="text-ink">↑↓</span> or{" "}
        <span className="text-ink">0–9</span> set score ·{" "}
        <span className="text-ink">←→</span> side ·{" "}
        <span className="text-ink">Del</span> clear ·{" "}
        <span className="text-ink">Enter</span> save ·{" "}
        <span className="text-ink">Tab</span> switch stage
      </p>

      <KeyboardBetProvider>
        <StageTabs panels={panels} />
      </KeyboardBetProvider>
    </div>
  );
}
