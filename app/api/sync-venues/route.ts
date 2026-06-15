import { NextResponse, type NextRequest } from "next/server";
import { syncVenues } from "@/lib/venues-sync";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Progressively backfills match venues from API-Football. Runs once a day at a
// quiet hour (no live matches) and queries only a few near-term dates, so it
// stays well clear of the live poller's daily API budget.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncVenues();
    if (result.updated > 0) {
      revalidatePath("/matches");
      revalidatePath("/profile");
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "venue sync failed" },
      { status: 500 },
    );
  }
}
