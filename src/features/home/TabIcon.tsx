import Svg, { Circle, Path, Rect } from "react-native-svg";

export type TabIconName = "home" | "map" | "feed" | "compass" | "profile";

/**
 * The tab bar's own icons: thin line drawings, as on Beli. An idle tab is a grey hairline drawing;
 * the open tab is the same drawing in the text colour with a slightly heavier line.
 */
export function TabIcon({ name, active, color, size = 26 }: { name: TabIconName; active: boolean; color: string; size?: number }) {
  const line = {
    stroke: color,
    strokeWidth: active ? 1.9 : 1.5,
    strokeLinejoin: "round",
    strokeLinecap: "round",
    fill: "none",
  } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" && (
        <>
          <Path d="M4 10.4L12 3.8l8 6.6V19a1.2 1.2 0 01-1.2 1.2H5.2A1.2 1.2 0 014 19z" {...line} />
          <Path d="M9.8 20.2v-4.4a2.2 2.2 0 014.4 0v4.4" {...line} />
        </>
      )}
      {name === "map" && (
        <>
          <Path d="M12 21.2s-7-6.1-7-11.4a7 7 0 1114 0c0 5.3-7 11.4-7 11.4z" {...line} />
          <Circle cx={12} cy={9.8} r={2.4} {...line} />
        </>
      )}
      {name === "feed" && (
        <>
          <Rect x={4} y={4.2} width={16} height={15.6} rx={2.4} {...line} />
          <Rect x={7.2} y={7.6} width={4} height={4} rx={0.6} {...line} />
          <Path d="M14 8h2.8M14 11.2h2.8M7.2 14.4h9.6M7.2 17h6" {...line} />
        </>
      )}
      {name === "compass" && (
        // "For you": a compass, needle pointing up and to the right. Plain line drawing like the other four.
        <>
          <Circle cx={12} cy={12} r={8.6} {...line} />
          <Path d="M15.7 8.3l-2.1 5.3-5.3 2.1 2.1-5.3z" {...line} />
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
