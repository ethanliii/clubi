import Svg, { Circle, Path, Rect } from "react-native-svg";

export type TabIconName = "home" | "map" | "feed" | "profile";

/**
 * The tab bar's own icons, always drawn as lines. The open tab is the same shape in the text colour
 * with a slightly heavier line; the idle ones are grey.
 */
export function TabIcon({ name, active, color, size = 25 }: { name: TabIconName; active: boolean; color: string; size?: number }) {
  const line = { stroke: color, strokeWidth: active ? 2.1 : 1.7, strokeLinejoin: "round", strokeLinecap: "round", fill: "none" } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" && (
        <>
          <Path d="M4 10.4L12 3.8l8 6.6V19a1.2 1.2 0 01-1.2 1.2H5.2A1.2 1.2 0 014 19z" {...line} />
          <Path d="M9.8 20v-4.6a2.2 2.2 0 014.4 0V20" {...line} />
        </>
      )}
      {name === "map" && (
        <>
          <Path d="M12 21.2s-7-6.1-7-11.4a7 7 0 1114 0c0 5.3-7 11.4-7 11.4z" {...line} />
          <Circle cx={12} cy={9.8} r={2.5} {...line} />
        </>
      )}
      {name === "feed" && (
        <>
          <Path d="M7.5 3.8h9" {...line} />
          <Rect x={4} y={7.6} width={16} height={12.6} rx={3.2} {...line} />
          <Path d="M8.2 12.2h7.6M8.2 15.6h4.6" {...line} />
        </>
      )}
      {name === "profile" && (
        <>
          <Circle cx={12} cy={8} r={3.9} {...line} />
          <Path d="M4.6 20.2c.7-3.9 3.6-5.9 7.4-5.9s6.7 2 7.4 5.9z" {...line} />
        </>
      )}
    </Svg>
  );
}
