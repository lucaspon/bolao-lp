import { requireUser } from "@/lib/auth/session";
import { getLeaderboard, type LeaderRow } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MEDALS = ["🥇", "🥈", "🥉"];

function Podium({ top, meId }: { top: LeaderRow[]; meId: number }) {
  // Assign places from the sorted list, then arrange as 2nd · 1st · 3rd.
  const ranked = top.map((row, index) => ({ row, place: index + 1 }));
  const order = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
  const heights: Record<number, number> = { 1: 116, 2: 88, 3: 70 };

  return (
    <div className="mb-8 flex items-end justify-center gap-3">
      {order.map(({ row, place }) => (
        <div key={row.userId} className="flex w-24 flex-col items-center">
          <div className="mb-1 text-2xl">{MEDALS[place - 1]}</div>
          <div
            className={cn(
              "truncate text-sm font-semibold",
              row.userId === meId ? "text-neon" : "text-ink",
            )}
          >
            {row.username}
          </div>
          <div className="tabular mb-2 font-display text-lg font-bold text-gold">
            {row.points}
          </div>
          <div
            className="flex w-full items-center justify-center rounded-t-lg border border-line bg-panel font-display text-2xl font-bold text-mute"
            style={{ height: heights[place] }}
          >
            {place}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function LeaderboardPage() {
  const me = await requireUser();
  const rows = await getLeaderboard();
  const hasPoints = rows.length > 0 && rows[0].points > 0;

  return (
    <div>
      <h1 className="mb-5 font-display text-2xl font-bold tracking-wide">Leaderboard</h1>

      {hasPoints ? (
        <Podium top={rows.slice(0, 3)} meId={me.id} />
      ) : (
        <p className="mb-6 rounded-xl border border-line bg-panel p-4 text-sm text-mute">
          No points scored yet — standings will light up once matches are played.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-mute">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">Player</th>
              <th className="px-3 py-2.5 text-right font-semibold">Exact</th>
              <th className="px-3 py-2.5 text-right font-semibold">Winner</th>
              <th className="px-3 py-2.5 text-right font-semibold">Picks</th>
              <th className="px-3 py-2.5 text-right font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isMe = row.userId === me.id;
              return (
                <tr
                  key={row.userId}
                  className={cn(
                    "border-t border-line",
                    isMe ? "bg-neon/10" : index % 2 ? "bg-panel/40" : "",
                  )}
                >
                  <td className="tabular px-3 py-2.5 text-mute">{index + 1}</td>
                  <td className="px-3 py-2.5 font-medium">
                    <span className={isMe ? "text-neon" : "text-ink"}>{row.username}</span>
                    {isMe && <span className="ml-1.5 text-xs text-mute">(you)</span>}
                  </td>
                  <td className="tabular px-3 py-2.5 text-right text-mute">{row.exact}</td>
                  <td className="tabular px-3 py-2.5 text-right text-mute">{row.correct}</td>
                  <td className="tabular px-3 py-2.5 text-right text-mute">{row.picks}</td>
                  <td className="tabular px-3 py-2.5 text-right font-display text-lg font-bold text-ink">
                    {row.points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
