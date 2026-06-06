// Scoring rules:
//   +3  exact score (e.g. predicted 2–1, result 2–1)
//   +1  correct outcome only (right winner, or a draw when you predicted a draw)
//    0  otherwise
export function scoreBet(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number,
): number {
  if (predHome === actualHome && predAway === actualAway) return 3;
  const predOutcome = Math.sign(predHome - predAway);
  const actualOutcome = Math.sign(actualHome - actualAway);
  return predOutcome === actualOutcome ? 1 : 0;
}
