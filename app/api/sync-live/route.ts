import { NextResponse, type NextRequest } from "next/server";
import { syncLiveScores } from "@/lib/live";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Overlays live in-play scores from API-Football. Runs on its own cron (more
// often than football-data needs) but only calls the API while a match is live,
// so it stays within the free plan's 100 requests/day.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncLiveScores();
    if (result.updated > 0 || (result.finalized ?? 0) > 0) {
      revalidatePath("/matches");
      revalidatePath("/leaderboard");
      revalidatePath("/profile");
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "live sync failed" },
      { status: 500 },
    );
  }
}
