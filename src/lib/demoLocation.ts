import * as Location from "expo-location";
import { useSyncExternalStore } from "react";
import { DEMO_COORDS } from "../../convex/lib/demo";

type Coords = { lat: number; lng: number };
type State = { isDemo: boolean; device: Coords | null };

let state: State = { isDemo: true, device: null };
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
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) {
    update({ isDemo: true });
    return;
  }
  const position = await Location.getCurrentPositionAsync({});
  update({ device: { lat: position.coords.latitude, lng: position.coords.longitude } });
}

export function setDemo(on: boolean) {
  update({ isDemo: on });
  if (!on) {
    locateDevice().catch(() => update({ isDemo: true }));
  }
}

export function useDemoLocation(): Coords & { isDemo: boolean; setDemo: (on: boolean) => void } {
  const current = useSyncExternalStore(subscribe, getState, getState);
  const coords = current.isDemo || current.device === null ? DEMO_COORDS : current.device;
  return { lat: coords.lat, lng: coords.lng, isDemo: current.isDemo, setDemo };
}

export { DEMO_COORDS };
