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
