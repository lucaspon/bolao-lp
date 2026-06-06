// Manual trigger for the live-results sync (the cron route does the same).
//   npm run db:sync                       (dev)
//   doppler run -c prd -- tsx scripts/sync.ts   (prod)
import { syncMatches } from "../lib/sync";

async function main() {
  const result = await syncMatches();
  console.log("Sync complete:", result);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
