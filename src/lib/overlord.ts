/**
 * Overlord mode: a testing switch that unlocks every screen regardless of sign-in or quiz state,
 * and shows a small floating button that opens the list of every page (/overlord).
 * It is on for the accounts named below, or after "Unlock every screen" is pressed on /overlord.
 */
import { useSyncExternalStore } from "react";

export const OVERLORD_USERNAMES = new Set(["ethan"]);

let on = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const get = () => on;

export function setOverlord(next: boolean) {
  if (on === next) return;
  on = next;
  listeners.forEach((listener) => listener());
}

export const useOverlord = () => useSyncExternalStore(subscribe, get, get);
