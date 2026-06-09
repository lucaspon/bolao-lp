"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { syncMatches } from "@/lib/sync";
import type { ActionResult } from "@/lib/types";

// Fixtures, kickoff times, knockout teams and results all come from
// football-data.org via the cron sync — no manual editing. This lets an admin
// force a refresh on demand instead of waiting for the next cron tick.
export async function adminSyncAction(): Promise<ActionResult> {
  const user = await getSession();
  if (!user?.isAdmin) return { ok: false, error: "Apenas administradores." };

  try {
    await syncMatches();
    revalidatePath("/matches");
    revalidatePath("/leaderboard");
    revalidatePath("/profile");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha na sincronização." };
  }
}
