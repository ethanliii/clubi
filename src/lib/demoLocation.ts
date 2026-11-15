import * as Location from "expo-location";
import { useEffect, useSyncExternalStore } from "react";

export const DEMO_COORDS = { lat: 37.7608, lng: -122.3861 } as const;
const FIX_TIMEOUT_MS = 5000;

type Coords = { lat: number; lng: number };
type State = { device: Coords | null; pinned: boolean; failed: boolean };

let state: State = { device: null, pinned: false, failed: false };
let locating = false;
const listeners = new Set<() => void>();

function update(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getState = () => state;

async function locateDevice() {
  if (locating) return;
  locating = true;
  const timer = setTimeout(() => update({ failed: true }), FIX_TIMEOUT_MS);
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) {
      update({ failed: true });
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    update({ device: { lat: position.coords.latitude, lng: position.coords.longitude }, failed: false });
  } catch {
    update({ failed: true });
  } finally {
    clearTimeout(timer);
    locating = false;
  }
}

export function setDemo(on: boolean) {
  update({ pinned: on });
  if (!on && state.device === null) {
    update({ failed: false });
    void locateDevice();
  }
}

export function useDemoLocation(): Coords & { isDemo: boolean; setDemo: (on: boolean) => void; ready: boolean } {
  const current = useSyncExternalStore(subscribe, getState, getState);
  useEffect(() => {
    if (!current.pinned && current.device === null && !current.failed) {
      void locateDevice();
    }
  }, [current.pinned, current.device, current.failed]);
  const useDevice = !current.pinned && current.device !== null;
  const coords = useDevice && current.device !== null ? current.device : DEMO_COORDS;
  return {
    lat: coords.lat,
    lng: coords.lng,
    isDemo: current.pinned || (current.device === null && current.failed),
    setDemo,
    ready: current.pinned || current.device !== null || current.failed,
  };
}
