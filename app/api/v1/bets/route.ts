import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getUserByApiToken,
  getMatchesForUser,
  getMatchById,
  upsertBet,
} from "@/lib/db/queries";
import { canBet } from "@/lib/match";
import type { User } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// Personal bearer-token API for managing your own palpites on pending matches.
// Auth: `Authorization: Bearer <token>` (token shown on Minhas Apostas).
async function authUser(request: NextRequest): Promise<User | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return token ? getUserByApiToken(token) : null;
}

// GET /api/v1/bets — your pending matches (still open to betting) and your
// current palpite on each.
export async function GET(request: NextRequest) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = await getMatchesForUser(user.id);
  const matches = all
    .filter((match) => canBet(match))
    .map((match) => ({
      matchId: match.id,
      home: match.homeTeam,
      away: match.awayTeam,
      kickoff: match.kickoffAt,
      bet: match.bet ? { home: match.bet.homePred, away: match.bet.awayPred } : null,
    }));
  return NextResponse.json({ matches });
}

const updateSchema = z.object({
  matchId: z.number().int(),
  home: z.number().int().min(0).max(30),
  away: z.number().int().min(0).max(30),
});

// PUT /api/v1/bets — set your palpite for a pending match.
// Body: { "matchId": 110, "home": 2, "away": 1 }
export async function PUT(request: NextRequest) {
  const user = await authUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body must be { matchId: number, home: 0-30, away: 0-30 }" },
      { status: 400 },
    );
  }

  const match = await getMatchById(parsed.data.matchId);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (!canBet(match)) {
    return NextResponse.json(
      { error: "This match is not open for betting (locked, undecided, or finished)" },
      { status: 409 },
    );
  }

  await upsertBet(user.id, match.id, parsed.data.home, parsed.data.away);
  revalidatePath("/matches");
  revalidatePath("/profile");
  revalidatePath("/leaderboard");

  return NextResponse.json({
    ok: true,
    matchId: match.id,
    home: match.homeTeam,
    away: match.awayTeam,
    bet: { home: parsed.data.home, away: parsed.data.away },
  });
}
