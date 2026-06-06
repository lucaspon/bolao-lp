import { requireUser } from "@/lib/auth/session";
import { getMatchesForUser, type MatchWithBet } from "@/lib/db/queries";
import { STAGES, canBet } from "@/lib/match";
import { GROUP_LABELS } from "@/lib/teams";
import { MatchCard } from "@/components/match-card";
import { StageTabs, type StagePanel } from "@/components/stage-tabs";

export const dynamic = "force-dynamic";

function MatchList({ matches }: { matches: MatchWithBet[] }) {
  return (
    <div className="grid gap-3">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </div>
  );
}

function GroupStage({ matches }: { matches: MatchWithBet[] }) {
  return (
    <div className="space-y-7">
      {GROUP_LABELS.map((label) => {
        const list = matches.filter((match) => match.groupLabel === label);
        if (list.length === 0) return null;
        return (
          <section key={label}>
            <h3 className="mb-2.5 font-display text-sm font-bold uppercase tracking-widest text-mute">
              Group {label}
            </h3>
            <MatchList matches={list} />
          </section>
        );
      })}
    </div>
  );
}

function StatChip({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-2.5">
      <div className="tabular font-display text-2xl font-bold text-neon">{value}</div>
      <div className="text-xs text-mute">{label}</div>
    </div>
  );
}

export default async function MatchesPage() {
  const user = await requireUser();
  const matches = await getMatchesForUser(user.id);

  const picks = matches.filter((match) => match.bet).length;
  const openNow = matches.filter((match) => canBet(match)).length;
  const points = matches.reduce((sum, match) => sum + (match.bet?.points ?? 0), 0);

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
          <MatchList matches={list} />
        ),
    };
  }).filter((panel) => panel.count > 0);

  return (
    <div>
      <div className="pitch-stripes mb-6 rounded-2xl border border-line bg-panel/40 p-5">
        <h1 className="font-display text-2xl font-bold tracking-wide">
          Hey, {user.username} 👋
        </h1>
        <p className="mb-4 text-sm text-mute">
          Predict the score of every match. +3 for an exact score, +1 for the right result.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <StatChip value={points} label="points so far" />
          <StatChip value={picks} label="picks made" />
          <StatChip value={openNow} label="open to bet" />
        </div>
      </div>

      <StageTabs panels={panels} />
    </div>
  );
}
