"use client";

import { useState, useTransition } from "react";
import { TEAMS } from "@/lib/teams";
import { setMatchInfoAction, setResultAction } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

export type AdminMatch = {
  id: number;
  extId: string;
  groupLabel: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  kickoffMs: number;
  homeScore: number | null;
  awayScore: number | null;
  betCount: number;
};

const TEAM_OPTIONS = Object.values(TEAMS).sort((a, b) => a.name.localeCompare(b.name));

function toLocalInput(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function TeamSelect({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string | null;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-line bg-base px-2 text-sm outline-none"
    >
      <option value="">{placeholder ? `— ${placeholder} —` : "— TBD —"}</option>
      {TEAM_OPTIONS.map((team) => (
        <option key={team.code} value={team.code}>
          {team.flag} {team.name}
        </option>
      ))}
    </select>
  );
}

export function AdminMatchRow({ match }: { match: AdminMatch }) {
  const [homeTeam, setHomeTeam] = useState(match.homeTeam ?? "");
  const [awayTeam, setAwayTeam] = useState(match.awayTeam ?? "");
  const [kickoff, setKickoff] = useState(toLocalInput(match.kickoffMs));
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  function saveInfo() {
    setNote(null);
    startTransition(async () => {
      const iso = new Date(kickoff).toISOString();
      const result = await setMatchInfoAction(match.id, homeTeam, awayTeam, iso);
      setNote({ ok: result.ok, text: result.ok ? "Saved" : result.error ?? "Error" });
    });
  }

  function saveResult(clear = false) {
    setNote(null);
    startTransition(async () => {
      const result = clear
        ? await setResultAction(match.id, "", "")
        : await setResultAction(match.id, homeScore, awayScore);
      if (clear && result.ok) {
        setHomeScore("");
        setAwayScore("");
      }
      setNote({ ok: result.ok, text: result.ok ? "Saved" : result.error ?? "Error" });
    });
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-mute">
        <span className="font-mono">
          {match.extId}
          {match.groupLabel ? ` · Group ${match.groupLabel}` : ""}
        </span>
        <span>{match.betCount} bets</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <TeamSelect value={homeTeam} onChange={setHomeTeam} placeholder={match.homePlaceholder} />
        <TeamSelect value={awayTeam} onChange={setAwayTeam} placeholder={match.awayPlaceholder} />
        <input
          type="datetime-local"
          value={kickoff}
          onChange={(event) => setKickoff(event.target.value)}
          className="h-9 rounded-md border border-line bg-base px-2 text-sm outline-none"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={saveInfo}
          disabled={pending}
          className="h-8 rounded-md border border-line px-3 text-sm hover:border-neon/60 hover:text-neon disabled:opacity-50"
        >
          Save teams & time
        </button>

        <span className="mx-1 h-5 w-px bg-line" />

        <span className="text-xs text-mute">Result:</span>
        <input
          inputMode="numeric"
          value={homeScore}
          onChange={(event) => setHomeScore(event.target.value.replace(/\D/g, ""))}
          placeholder="–"
          className="tabular h-8 w-12 rounded-md border border-line bg-base text-center text-sm outline-none"
        />
        <span className="text-mute">:</span>
        <input
          inputMode="numeric"
          value={awayScore}
          onChange={(event) => setAwayScore(event.target.value.replace(/\D/g, ""))}
          placeholder="–"
          className="tabular h-8 w-12 rounded-md border border-line bg-base text-center text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => saveResult(false)}
          disabled={pending}
          className="h-8 rounded-md bg-neon px-3 text-sm font-semibold text-base hover:brightness-110 disabled:opacity-50"
        >
          Save result
        </button>
        <button
          type="button"
          onClick={() => saveResult(true)}
          disabled={pending}
          className="h-8 rounded-md px-2 text-xs text-mute hover:text-danger disabled:opacity-50"
        >
          Clear
        </button>

        {note && (
          <span className={cn("text-xs", note.ok ? "text-neon" : "text-danger")}>
            {note.text}
          </span>
        )}
      </div>
    </div>
  );
}
