import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

/**
 * Recent searches (Spotify / Beli style): what you opened from search, newest first, on this device only.
 * Kept small (8 items) so it fits in SecureStore; on web or if storage fails it just lives in memory.
 */
export type Recent =
  | { type: "place"; kind: "place" | "event"; id: string; name: string; sub: string; imageUrl?: string; category: string }
  | { type: "person"; userId: string; name: string; sub: string; avatarUrl?: string };

const KEY = "clubi.recentSearches";
const MAX = 8;
let cache: Recent[] | null = null;
const listeners = new Set<(r: Recent[]) => void>();

const keyOf = (r: Recent) => (r.type === "place" ? `p:${r.id}` : `u:${r.userId}`);

async function load(): Promise<Recent[]> {
  if (cache) return cache;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    cache = raw ? (JSON.parse(raw) as Recent[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function save(next: Recent[]) {
  cache = next;
  listeners.forEach((l) => l(next));
  SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => undefined);
}

export function addRecent(r: Recent) {
  void load().then((list) => save([r, ...list.filter((x) => keyOf(x) !== keyOf(r))].slice(0, MAX)));
}

export function removeRecent(r: Recent) {
  void load().then((list) => save(list.filter((x) => keyOf(x) !== keyOf(r))));
}

export function useRecentSearches(): Recent[] {
  const [list, setList] = useState<Recent[]>(cache ?? []);
  useEffect(() => {
    listeners.add(setList);
    void load().then(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}

export { keyOf as recentKey };
