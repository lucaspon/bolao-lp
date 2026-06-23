import { getTeam } from "@/lib/teams";
import type { TeamStanding } from "@/lib/standings";
import { cn } from "@/lib/utils";

// 12 group tables (one column each on wide screens), top-2 highlighted green and
// the qualifying best-3rd in gold.
export function GroupStandings({
  groups,
  qualifyingThirdGroups,
}: {
  groups: Record<string, TeamStanding[]>;
  qualifyingThirdGroups: string[];
}) {
  const labels = Object.keys(groups).sort();
  if (labels.length === 0) return null;
  const thirds = new Set(qualifyingThirdGroups);

  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
      {labels.map((label) => (
        <div key={label} className="rounded-lg border border-line bg-panel p-1.5">
          <div className="mb-1 px-0.5 font-display text-xs font-bold text-neon">{label}</div>
          <div className="flex flex-col gap-0.5">
            {groups[label].map((row, index) => {
              const team = getTeam(row.team);
              const qualifies = index < 2 || (index === 2 && thirds.has(label));
              const posColor =
                index < 2 ? "text-neon" : index === 2 && thirds.has(label) ? "text-gold" : "text-mute";
              return (
                <div key={row.team} className="flex items-center gap-1 text-[10px] leading-none">
                  <span className={cn("w-2.5 shrink-0 text-center font-bold", posColor)}>
                    {index + 1}
                  </span>
                  <span className="shrink-0 text-[11px]">{team ? team.flag : "⚽"}</span>
                  <span className={cn("min-w-0 flex-1 truncate", qualifies ? "text-ink" : "text-mute")}>
                    {team ? team.code : row.team}
                  </span>
                  <span className="tabular shrink-0 font-semibold text-mute">{row.points}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
