// Static reference data for the 48 nations and their group draw.
//
// NOTE: group assignments and the team list are a best-effort snapshot of the
// 2026 draw and should be checked against the official schedule. Everything here
// is editable by an admin in the app, so getting a code wrong is not fatal.

export type Team = {
  code: string;
  name: string;
  flag: string;
};

export const TEAMS: Record<string, Team> = {
  MEX: { code: "MEX", name: "Mexico", flag: "🇲🇽" },
  CAN: { code: "CAN", name: "Canada", flag: "🇨🇦" },
  USA: { code: "USA", name: "United States", flag: "🇺🇸" },
  ARG: { code: "ARG", name: "Argentina", flag: "🇦🇷" },
  BRA: { code: "BRA", name: "Brazil", flag: "🇧🇷" },
  FRA: { code: "FRA", name: "France", flag: "🇫🇷" },
  ENG: { code: "ENG", name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  ESP: { code: "ESP", name: "Spain", flag: "🇪🇸" },
  POR: { code: "POR", name: "Portugal", flag: "🇵🇹" },
  GER: { code: "GER", name: "Germany", flag: "🇩🇪" },
  NED: { code: "NED", name: "Netherlands", flag: "🇳🇱" },
  BEL: { code: "BEL", name: "Belgium", flag: "🇧🇪" },
  CRO: { code: "CRO", name: "Croatia", flag: "🇭🇷" },
  ITA: { code: "ITA", name: "Italy", flag: "🇮🇹" },
  SUI: { code: "SUI", name: "Switzerland", flag: "🇨🇭" },
  DEN: { code: "DEN", name: "Denmark", flag: "🇩🇰" },
  URU: { code: "URU", name: "Uruguay", flag: "🇺🇾" },
  COL: { code: "COL", name: "Colombia", flag: "🇨🇴" },
  JPN: { code: "JPN", name: "Japan", flag: "🇯🇵" },
  KOR: { code: "KOR", name: "South Korea", flag: "🇰🇷" },
  MAR: { code: "MAR", name: "Morocco", flag: "🇲🇦" },
  SEN: { code: "SEN", name: "Senegal", flag: "🇸🇳" },
  AUS: { code: "AUS", name: "Australia", flag: "🇦🇺" },
  IRN: { code: "IRN", name: "Iran", flag: "🇮🇷" },
  KSA: { code: "KSA", name: "Saudi Arabia", flag: "🇸🇦" },
  QAT: { code: "QAT", name: "Qatar", flag: "🇶🇦" },
  ECU: { code: "ECU", name: "Ecuador", flag: "🇪🇨" },
  NGA: { code: "NGA", name: "Nigeria", flag: "🇳🇬" },
  EGY: { code: "EGY", name: "Egypt", flag: "🇪🇬" },
  GHA: { code: "GHA", name: "Ghana", flag: "🇬🇭" },
  CIV: { code: "CIV", name: "Ivory Coast", flag: "🇨🇮" },
  CMR: { code: "CMR", name: "Cameroon", flag: "🇨🇲" },
  TUN: { code: "TUN", name: "Tunisia", flag: "🇹🇳" },
  ALG: { code: "ALG", name: "Algeria", flag: "🇩🇿" },
  POL: { code: "POL", name: "Poland", flag: "🇵🇱" },
  AUT: { code: "AUT", name: "Austria", flag: "🇦🇹" },
  TUR: { code: "TUR", name: "Turkey", flag: "🇹🇷" },
  NOR: { code: "NOR", name: "Norway", flag: "🇳🇴" },
  SCO: { code: "SCO", name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  PAR: { code: "PAR", name: "Paraguay", flag: "🇵🇾" },
  PAN: { code: "PAN", name: "Panama", flag: "🇵🇦" },
  CRC: { code: "CRC", name: "Costa Rica", flag: "🇨🇷" },
  JAM: { code: "JAM", name: "Jamaica", flag: "🇯🇲" },
  NZL: { code: "NZL", name: "New Zealand", flag: "🇳🇿" },
  UZB: { code: "UZB", name: "Uzbekistan", flag: "🇺🇿" },
  JOR: { code: "JOR", name: "Jordan", flag: "🇯🇴" },
  IRQ: { code: "IRQ", name: "Iraq", flag: "🇮🇶" },
  RSA: { code: "RSA", name: "South Africa", flag: "🇿🇦" },
  // Added to match the real 2026 draw (football-data.org TLAs).
  URY: { code: "URY", name: "Uruguay", flag: "🇺🇾" },
  CZE: { code: "CZE", name: "Czechia", flag: "🇨🇿" },
  BIH: { code: "BIH", name: "Bosnia & Herzegovina", flag: "🇧🇦" },
  COD: { code: "COD", name: "DR Congo", flag: "🇨🇩" },
  CPV: { code: "CPV", name: "Cape Verde", flag: "🇨🇻" },
  CUW: { code: "CUW", name: "Curaçao", flag: "🇨🇼" },
  HAI: { code: "HAI", name: "Haiti", flag: "🇭🇹" },
  SWE: { code: "SWE", name: "Sweden", flag: "🇸🇪" },
};

// 12 groups (A–L) of 4 teams each.
export const GROUPS: Record<string, string[]> = {
  A: ["MEX", "CRO", "NGA", "KSA"],
  B: ["CAN", "BEL", "EGY", "QAT"],
  C: ["ARG", "NOR", "AUS", "JAM"],
  D: ["USA", "SUI", "SEN", "UZB"],
  E: ["ESP", "DEN", "CIV", "PAN"],
  F: ["FRA", "AUT", "JPN", "JOR"],
  G: ["BRA", "TUR", "MAR", "NZL"],
  H: ["POR", "SCO", "KOR", "IRQ"],
  I: ["ENG", "COL", "GHA", "CRC"],
  J: ["GER", "URU", "IRN", "RSA"],
  K: ["NED", "ECU", "TUN", "PAR"],
  L: ["ITA", "POL", "CMR", "ALG"],
};

export const GROUP_LABELS = Object.keys(GROUPS);

// Host-country venues, rotated across the schedule.
export const VENUES = [
  "MetLife Stadium, New York",
  "SoFi Stadium, Los Angeles",
  "AT&T Stadium, Dallas",
  "Mercedes-Benz Stadium, Atlanta",
  "Hard Rock Stadium, Miami",
  "NRG Stadium, Houston",
  "Lumen Field, Seattle",
  "Levi's Stadium, San Francisco Bay",
  "Arrowhead Stadium, Kansas City",
  "Lincoln Financial Field, Philadelphia",
  "Gillette Stadium, Boston",
  "Estadio Azteca, Mexico City",
  "Estadio Akron, Guadalajara",
  "Estadio BBVA, Monterrey",
  "BMO Field, Toronto",
  "BC Place, Vancouver",
];

export function getTeam(code: string | null | undefined): Team | null {
  if (!code) return null;
  return TEAMS[code] ?? null;
}
