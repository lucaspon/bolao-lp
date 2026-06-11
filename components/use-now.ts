"use client";

import { useSyncExternalStore } from "react";

// A shared "current time" clock that ticks every 30s. Built on
// useSyncExternalStore so it is SSR-safe (returns null on the server) without
// calling setState inside an effect.
let current = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (timer === null) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((listener) => listener());
    }, 30_000);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  if (current === 0) current = Date.now();
  return current;
}

function getServerSnapshot(): number {
  return 0;
}

// Returns the current time in ms, or null before the component has mounted.
export function useNow(): number | null {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return now === 0 ? null : now;
}

// A separate 1-second clock for things that show seconds (the bet-deadline
// countdown). Kept apart from useNow so the 30s consumers (every match pill)
// don't re-render every second.
let fastCurrent = 0;
const fastListeners = new Set<() => void>();
let fastTimer: ReturnType<typeof setInterval> | null = null;

function subscribeFast(callback: () => void) {
  fastListeners.add(callback);
  if (fastTimer === null) {
    fastCurrent = Date.now();
    fastTimer = setInterval(() => {
      fastCurrent = Date.now();
      fastListeners.forEach((listener) => listener());
    }, 1_000);
  }
  return () => {
    fastListeners.delete(callback);
    if (fastListeners.size === 0 && fastTimer !== null) {
      clearInterval(fastTimer);
      fastTimer = null;
    }
  };
}

function getFastSnapshot(): number {
  if (fastCurrent === 0) fastCurrent = Date.now();
  return fastCurrent;
}

export function useNowFast(): number | null {
  const now = useSyncExternalStore(subscribeFast, getFastSnapshot, getServerSnapshot);
  return now === 0 ? null : now;
}
