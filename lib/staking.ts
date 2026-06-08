// Stake limits (cents) and the two staking windows.
export const ENTRY_MIN_CENTS = 5_000; // R$50 floor for a first stake
export const ENTRY_MAX_TOTAL_CENTS = 100_000; // R$1000 cap on total per user

export type StakingPhase = "initial" | "group_running" | "topup" | "closed";

export type StakingWindow = {
  phase: StakingPhase;
  open: boolean; // staking allowed right now
  topUpOnly: boolean; // top-up window — must already have a stake
};

export type StakingBounds = {
  firstGroupMs: number;
  lastGroupMs: number;
  firstKnockoutMs: number;
};

// Window 1: bet freely until the group stage begins.
// Closed while the group stage is running.
// Window 2: top-ups only, from the last group match until the knockouts begin.
export function stakingWindow(bounds: StakingBounds, now: number = Date.now()): StakingWindow {
  if (now < bounds.firstGroupMs) return { phase: "initial", open: true, topUpOnly: false };
  if (now < bounds.lastGroupMs) return { phase: "group_running", open: false, topUpOnly: false };
  if (now < bounds.firstKnockoutMs) return { phase: "topup", open: true, topUpOnly: true };
  return { phase: "closed", open: false, topUpOnly: false };
}
