// One-time venue pre-fill for all 104 matches, sourced from the official 2026
// World Cup schedule (Wikipedia per-group + knockout pages), validated against
// the venues already captured live from API-Football. Group matches are keyed by
// the (unordered) team-code pair; knockout matches by FIFA match number via
// lib/bracket.ts. Run: `doppler run -c prd -- npx tsx scripts/prefill-venues.ts`
// (add DRY_RUN=1 to report coverage without writing).
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { matches } from "@/lib/db/schema";
import { venueLabel } from "@/lib/venues";
import { matchNoForApiId } from "@/lib/bracket";

const NAME_TO_CODE: Record<string, string> = {
  Mexico: "MEX", "South Africa": "RSA", "South Korea": "KOR", "Czech Republic": "CZE",
  Canada: "CAN", "Bosnia and Herzegovina": "BIH", Qatar: "QAT", Switzerland: "SUI",
  Brazil: "BRA", Morocco: "MAR", Haiti: "HAI", Scotland: "SCO",
  "United States": "USA", Paraguay: "PAR", Australia: "AUS", Turkey: "TUR",
  Germany: "GER", "Curaçao": "CUW", "Ivory Coast": "CIV", Ecuador: "ECU",
  Netherlands: "NED", Japan: "JPN", Sweden: "SWE", Tunisia: "TUN",
  Belgium: "BEL", Egypt: "EGY", Iran: "IRN", "New Zealand": "NZL",
  Spain: "ESP", "Cape Verde": "CPV", "Saudi Arabia": "KSA", Uruguay: "URY",
  France: "FRA", Senegal: "SEN", Iraq: "IRQ", Norway: "NOR",
  Argentina: "ARG", Algeria: "ALG", Austria: "AUT", Jordan: "JOR",
  Portugal: "POR", "DR Congo": "COD", Uzbekistan: "UZB", Colombia: "COL",
  England: "ENG", Croatia: "CRO", Ghana: "GHA", Panama: "PAN",
};

// [home, away, city] — 72 group matches.
const GROUP: [string, string, string][] = [
  ["Mexico", "South Africa", "Mexico City"], ["South Korea", "Czech Republic", "Zapopan"],
  ["Czech Republic", "South Africa", "Atlanta"], ["Mexico", "South Korea", "Zapopan"],
  ["Czech Republic", "Mexico", "Mexico City"], ["South Africa", "South Korea", "Guadalupe"],
  ["Canada", "Bosnia and Herzegovina", "Toronto"], ["Qatar", "Switzerland", "Santa Clara"],
  ["Switzerland", "Bosnia and Herzegovina", "Inglewood"], ["Canada", "Qatar", "Vancouver"],
  ["Switzerland", "Canada", "Vancouver"], ["Bosnia and Herzegovina", "Qatar", "Seattle"],
  ["Brazil", "Morocco", "East Rutherford"], ["Haiti", "Scotland", "Foxborough"],
  ["Scotland", "Morocco", "Foxborough"], ["Brazil", "Haiti", "Philadelphia"],
  ["Scotland", "Brazil", "Miami Gardens"], ["Morocco", "Haiti", "Atlanta"],
  ["United States", "Paraguay", "Inglewood"], ["Australia", "Turkey", "Vancouver"],
  ["United States", "Australia", "Seattle"], ["Turkey", "Paraguay", "Santa Clara"],
  ["Turkey", "United States", "Inglewood"], ["Paraguay", "Australia", "Santa Clara"],
  ["Germany", "Curaçao", "Houston"], ["Ivory Coast", "Ecuador", "Philadelphia"],
  ["Germany", "Ivory Coast", "Toronto"], ["Ecuador", "Curaçao", "Kansas City"],
  ["Curaçao", "Ivory Coast", "Philadelphia"], ["Ecuador", "Germany", "East Rutherford"],
  ["Netherlands", "Japan", "Arlington"], ["Sweden", "Tunisia", "Guadalupe"],
  ["Netherlands", "Sweden", "Houston"], ["Tunisia", "Japan", "Guadalupe"],
  ["Japan", "Sweden", "Arlington"], ["Tunisia", "Netherlands", "Kansas City"],
  ["Belgium", "Egypt", "Seattle"], ["Iran", "New Zealand", "Inglewood"],
  ["Belgium", "Iran", "Inglewood"], ["New Zealand", "Egypt", "Vancouver"],
  ["Egypt", "Iran", "Seattle"], ["New Zealand", "Belgium", "Vancouver"],
  ["Spain", "Cape Verde", "Atlanta"], ["Saudi Arabia", "Uruguay", "Miami Gardens"],
  ["Spain", "Saudi Arabia", "Atlanta"], ["Uruguay", "Cape Verde", "Miami Gardens"],
  ["Cape Verde", "Saudi Arabia", "Houston"], ["Uruguay", "Spain", "Zapopan"],
  ["France", "Senegal", "East Rutherford"], ["Iraq", "Norway", "Foxborough"],
  ["France", "Iraq", "Philadelphia"], ["Norway", "Senegal", "East Rutherford"],
  ["Norway", "France", "Foxborough"], ["Senegal", "Iraq", "Toronto"],
  ["Argentina", "Algeria", "Kansas City"], ["Austria", "Jordan", "Santa Clara"],
  ["Argentina", "Austria", "Arlington"], ["Jordan", "Algeria", "Santa Clara"],
  ["Algeria", "Austria", "Kansas City"], ["Jordan", "Argentina", "Arlington"],
  ["Portugal", "DR Congo", "Houston"], ["Uzbekistan", "Colombia", "Mexico City"],
  ["Portugal", "Uzbekistan", "Houston"], ["Colombia", "DR Congo", "Zapopan"],
  ["Colombia", "Portugal", "Miami Gardens"], ["DR Congo", "Uzbekistan", "Atlanta"],
  ["England", "Croatia", "Arlington"], ["Ghana", "Panama", "Toronto"],
  ["England", "Ghana", "Foxborough"], ["Panama", "Croatia", "Toronto"],
  ["Panama", "England", "East Rutherford"], ["Croatia", "Ghana", "Philadelphia"],
];

// FIFA match number -> city, for the 32 knockout matches.
const KNOCKOUT: Record<number, string> = {
  73: "Inglewood", 74: "Foxborough", 75: "Guadalupe", 76: "Houston",
  77: "East Rutherford", 78: "Arlington", 79: "Mexico City", 80: "Atlanta",
  81: "Santa Clara", 82: "Seattle", 83: "Toronto", 84: "Inglewood",
  85: "Vancouver", 86: "Miami Gardens", 87: "Kansas City", 88: "Arlington",
  89: "Philadelphia", 90: "Houston", 91: "East Rutherford", 92: "Mexico City",
  93: "Arlington", 94: "Seattle", 95: "Atlanta", 96: "Vancouver",
  97: "Foxborough", 98: "Inglewood", 99: "Miami Gardens", 100: "Kansas City",
  101: "Arlington", 102: "Atlanta", 103: "Miami Gardens", 104: "East Rutherford",
};

const pairKey = (a: string, b: string) => [a, b].sort().join("-");

async function main() {
  const dryRun = process.env.DRY_RUN === "1";
  const all = await db.select().from(matches);

  // Group matches indexed by unordered code pair.
  const groupByPair = new Map<string, (typeof all)[number]>();
  for (const m of all) {
    if (m.stage === "group" && m.homeTeam && m.awayTeam) {
      groupByPair.set(pairKey(m.homeTeam, m.awayTeam), m);
    }
  }

  const plan: { id: number; label: string; desc: string }[] = [];
  const problems: string[] = [];

  for (const [home, away, city] of GROUP) {
    const hc = NAME_TO_CODE[home];
    const ac = NAME_TO_CODE[away];
    if (!hc || !ac) { problems.push(`no code for ${home} or ${away}`); continue; }
    const match = groupByPair.get(pairKey(hc, ac));
    const label = venueLabel(city);
    if (!match) { problems.push(`no DB group match for ${hc}-${ac} (${city})`); continue; }
    if (!label) { problems.push(`no venue label for "${city}"`); continue; }
    plan.push({ id: match.id, label, desc: `${hc}-${ac}` });
  }

  for (const m of all) {
    if (m.stage === "group") continue;
    const no = matchNoForApiId(m.apiMatchId);
    if (!no) { problems.push(`no FIFA matchNo for knockout apiId=${m.apiMatchId} (id ${m.id})`); continue; }
    const city = KNOCKOUT[no];
    const label = city ? venueLabel(city) : null;
    if (!label) { problems.push(`no knockout venue for matchNo ${no}`); continue; }
    plan.push({ id: m.id, label, desc: `M${no} ${m.stage}` });
  }

  console.log(`planned updates: ${plan.length}/104`);
  console.log(`problems: ${problems.length}`);
  problems.forEach((p) => console.log("  ⚠️ ", p));

  if (dryRun) {
    const byCity = new Map<string, number>();
    for (const p of plan) byCity.set(p.label, (byCity.get(p.label) ?? 0) + 1);
    console.log("\nper-venue counts:");
    [...byCity.entries()].sort().forEach(([c, n]) => console.log(`  ${c}: ${n}`));
    console.log("\nDRY_RUN — no writes.");
    process.exit(problems.length === 0 ? 0 : 1);
  }

  let written = 0;
  for (const p of plan) {
    await db.update(matches).set({ venue: p.label }).where(eq(matches.id, p.id));
    written += 1;
  }
  console.log(`\n✅ wrote ${written} venues.`);
  process.exit(problems.length === 0 ? 0 : 1);
}

main();
