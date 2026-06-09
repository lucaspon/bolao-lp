// Times are shown in a fixed display timezone so server and client render the
// same string (no hydration mismatch). Defaults to Brazil time.
const DISPLAY_TZ = process.env.NEXT_PUBLIC_DISPLAY_TZ ?? "America/Sao_Paulo";

export function formatKickoff(date: Date | string | number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
  }).format(new Date(date));
}

// Compact label for the match pills, e.g. "11 Jun 13:00".
export function formatPillKickoff(date: Date | string | number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TZ,
  }).format(new Date(date));
}

export function formatDay(date: Date | string | number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: DISPLAY_TZ,
  }).format(new Date(date));
}

// "em 3d 4h", "em 52m", "começou" — used by the countdown.
export function formatCountdown(targetMs: number, now: number = Date.now()): string {
  const diff = targetMs - now;
  if (diff <= 0) return "começou";
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (days > 0) return `em ${days}d ${hours}h`;
  if (hours > 0) return `em ${hours}h ${mins}m`;
  return `em ${mins}m`;
}
