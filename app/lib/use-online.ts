"use client";

import { useSyncExternalStore } from "react";

// Offline means the browser says so, or the last request to devnet failed at the network level.
let fetchFailed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Called by the RPC layer after each request. */
export function reportNetwork(ok: boolean) {
  if (fetchFailed === !ok) return;
  fetchFailed = !ok;
  notify();
}

/** True for a fetch that never reached a server (not for HTTP errors like 429). */
export function isNetworkFailure(e: unknown): boolean {
  for (let cur: unknown = e; cur; cur = (cur as { cause?: unknown }).cause) {
    if (cur instanceof TypeError) return true;
  }
  return false;
}

const subscribe = (cb: () => void) => {
  const back = () => ((fetchFailed = false), cb());
  window.addEventListener("online", back);
  window.addEventListener("offline", cb);
  listeners.add(cb);
  return () => {
    window.removeEventListener("online", back);
    window.removeEventListener("offline", cb);
    listeners.delete(cb);
  };
};

/** Network state as React state. Assumes online during server render. */
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine && !fetchFailed, () => true);
