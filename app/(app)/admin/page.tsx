import { requireAdmin } from "@/lib/auth/session";
import { getAdminMatches, getPaymentsForAdmin, getPotTotalCents } from "@/lib/db/queries";
import { STAGES } from "@/lib/match";
import { AdminMatchRow, type AdminMatch } from "@/components/admin-match-row";
import { StageTabs, type StagePanel } from "@/components/stage-tabs";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const brl = (cents: number) => `R$${(cents / 100).toFixed(0)}`;

export default async function AdminPage() {
  await requireAdmin();
  const [rows, paymentRows, potCents] = await Promise.all([
    getAdminMatches(),
    getPaymentsForAdmin(),
    getPotTotalCents(),
  ]);
  const paidCount = paymentRows.filter((row) => row.stakeCents > 0).length;

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
    <div className="mx-auto max-w-5xl">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold tracking-wide">Admin</h1>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-wide">Payments</h2>
          <span className="text-sm text-mute">
            Pot <span className="font-semibold text-gold">{brl(potCents)}</span> · {paidCount}/
            {paymentRows.length} paid
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-mute">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Player</th>
                <th className="px-3 py-2.5 text-right font-semibold">Stake</th>
                <th className="px-3 py-2.5 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((row, index) => (
                <tr
                  key={row.userId}
                  className={cn("border-t border-line", index % 2 ? "bg-panel/40" : "")}
                >
                  <td className="px-3 py-2.5 font-medium text-ink">{row.username}</td>
                  <td className="tabular px-3 py-2.5 text-right">
                    {row.stakeCents > 0 ? brl(row.stakeCents) : "–"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {row.stakeCents > 0 ? (
                      <span className="text-neon">paid</span>
                    ) : (
                      <span className="text-mute">unpaid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-3">
        <h2 className="font-display text-lg font-bold tracking-wide">Fixtures</h2>
        <p className="text-sm text-mute">
          Fill in knockout teams as they are decided, adjust kickoff times, and enter
          final scores. Saving a result re-scores every bet on that match.
        </p>
      </div>
      <StageTabs panels={panels} />
    </div>
  );
}
