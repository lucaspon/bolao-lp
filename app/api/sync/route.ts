import { NextResponse, type NextRequest } from "next/server";
import { syncMatches } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Pulls live results from football-data.org. Called by the Vercel cron (which
// sends `Authorization: Bearer <CRON_SECRET>`) or manually with the same secret.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncMatches();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "sync failed" },
      { status: 500 },
    );
  }
}
