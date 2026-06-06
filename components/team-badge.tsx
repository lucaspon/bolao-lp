import { getTeam } from "@/lib/teams";
import { cn } from "@/lib/utils";

type Props = {
  code: string | null;
  placeholder?: string | null;
  align?: "left" | "right";
  className?: string;
};

// Shows a team's flag + name, or a greyed-out placeholder when the team is not
// yet decided (knockout slots like "Winner Group A").
export function TeamBadge({ code, placeholder, align = "left", className }: Props) {
  const team = getTeam(code);
  const rightToLeft = align === "right";

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        rightToLeft && "flex-row-reverse text-right",
        className,
      )}
    >
      <span className="text-2xl leading-none">{team ? team.flag : "⚽"}</span>
      {team ? (
        <span className="truncate font-display text-lg font-semibold tracking-wide text-ink">
          {team.name}
        </span>
      ) : (
        <span className="truncate text-sm italic text-mute">
          {placeholder ?? "To be decided"}
        </span>
      )}
    </div>
  );
}
