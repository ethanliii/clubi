// Types for `import { MapCanvas } from "./MapCanvas"`. The bundler picks MapCanvas.native.tsx
// (iOS, Android) or MapCanvas.web.tsx (browser); both implement exactly this.
import type { ReactElement } from "react";
import type { MapCanvasProps } from "./types";

export function MapCanvas(props: MapCanvasProps): ReactElement;
/** Credit for the map picture itself, shown next to the data attribution. Empty when the map draws its own. */
export const TILE_ATTRIBUTION: string;
