import { requireAdmin } from "@/lib/auth/session";
import { getAdminMatches } from "@/lib/db/queries";
import { STAGES } from "@/lib/match";
import { AdminMatchRow, type AdminMatch } from "@/components/admin-match-row";
import { StageTabs, type StagePanel } from "@/components/stage-tabs";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const rows = await getAdminMatches();

  const toAdminMatch = ({ match, betCount }: (typeof rows)[number]): AdminMatch => ({
    id: match.id,
    extId: match.extId,
    groupLabel: match.groupLabel,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homePlaceholder: match.homePlaceholder,
    awayPlaceholder: match.awayPlaceholder,
    kickoffMs: new Date(match.kickoffAt).getTime(),
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    betCount,
  });

  const panels: StagePanel[] = STAGES.map((stage) => {
    const list = rows.filter((row) => row.match.stage === stage.key);
    return {
      key: stage.key,
      short: stage.short,
      count: list.length,
      node: (
        <div className="grid gap-2.5">
          {list.map((row) => (
            <AdminMatchRow key={row.match.id} match={toAdminMatch(row)} />
          ))}
        </div>
      ),
    };
  }).filter((panel) => panel.count > 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-wide">Admin · Fixtures</h1>
        <p className="text-sm text-mute">
          Fill in knockout teams as they are decided, adjust kickoff times, and enter
          final scores. Saving a result re-scores every bet on that match.
        </p>
      </div>
      <StageTabs panels={panels} />
    </div>
  );
}
