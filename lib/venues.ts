// Maps API-Football's venue.city for the 16 host venues to a friendly
// "City, Country" label shown on match cards. Keyed by the lower-cased city the
// API returns (a few are metro-area names, e.g. Arlington = Dallas).
const VENUE_CITY: Record<string, { label: string; country: string }> = {
  // United States
  "new york new jersey": { label: "New York/NJ", country: "US" },
  "east rutherford": { label: "New York/NJ", country: "US" },
  "los angeles": { label: "Los Angeles", country: "US" },
  inglewood: { label: "Los Angeles", country: "US" },
  arlington: { label: "Dallas", country: "US" },
  atlanta: { label: "Atlanta", country: "US" },
  miami: { label: "Miami", country: "US" },
  "miami gardens": { label: "Miami", country: "US" },
  houston: { label: "Houston", country: "US" },
  seattle: { label: "Seattle", country: "US" },
  "santa clara": { label: "SF Bay Area", country: "US" },
  "san francisco": { label: "SF Bay Area", country: "US" },
  "kansas city": { label: "Kansas City", country: "US" },
  philadelphia: { label: "Philadelphia", country: "US" },
  boston: { label: "Boston", country: "US" },
  foxborough: { label: "Boston", country: "US" },
  // Mexico
  "mexico city": { label: "Mexico City", country: "MX" },
  guadalajara: { label: "Guadalajara", country: "MX" },
  zapopan: { label: "Guadalajara", country: "MX" }, // Estadio Akron
  monterrey: { label: "Monterrey", country: "MX" },
  guadalupe: { label: "Monterrey", country: "MX" }, // Estadio BBVA
  // Canada
  toronto: { label: "Toronto", country: "CA" },
  vancouver: { label: "Vancouver", country: "CA" },
};

// "Miami" -> "Miami, US". Falls back to the raw city for anything unmapped.
export function venueLabel(city: string | null | undefined): string | null {
  if (!city) return null;
  const trimmed = city.trim();
  if (!trimmed) return null;
  const hit = VENUE_CITY[trimmed.toLowerCase()];
  return hit ? `${hit.label}, ${hit.country}` : trimmed;
}
