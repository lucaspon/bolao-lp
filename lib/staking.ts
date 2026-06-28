// Stake limits (cents) and the two staking windows.
export const ENTRY_MIN_CENTS = 2_500; // R$25 floor for a first stake
export const ENTRY_MAX_TOTAL_CENTS = 100_000; // R$1000 cap on total per user

export type StakingPhase = "initial" | "group_running" | "topup" | "closed";

export type StakingWindow = {
  phase: StakingPhase;
  open: boolean; // staking allowed right now
  topUpOnly: boolean; // top-up window — must already have a stake
  firstTimeOnly: boolean; // join window — must NOT already have a stake
};

export type StakingBounds = {
  firstGroupMs: number;
  lastGroupMs: number;
  firstKnockoutMs: number;
  // Kickoff of Brazil's Round-of-32 match — the top-up window stays open until
  // Brazil plays. Falls back to firstKnockoutMs until that match is known.
  brazilKnockoutMs: number;
};

// Window 1 ("initial"): bet freely until the group stage begins.
// "group_running": new players may still JOIN (first stake only) right up to the
//   last group match. They can only bet on matches that haven't locked, so their
//   elapsed/ongoing matches score 0. Existing players can't top up here — that
//   would retroactively inflate group points they've already earned.
// Window 2 ("topup"): top-ups only, from the last group match until Brazil's
//   first knockout match kicks off.
export function stakingWindow(bounds: StakingBounds, now: number = Date.now()): StakingWindow {
  if (now < bounds.firstGroupMs)
    return { phase: "initial", open: true, topUpOnly: false, firstTimeOnly: false };
  if (now < bounds.lastGroupMs)
    return { phase: "group_running", open: true, topUpOnly: false, firstTimeOnly: true };
  if (now < bounds.brazilKnockoutMs)
    return { phase: "topup", open: true, topUpOnly: true, firstTimeOnly: false };
  return { phase: "closed", open: false, topUpOnly: false, firstTimeOnly: false };
}
