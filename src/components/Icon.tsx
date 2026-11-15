import Svg, { Circle, Path, Rect } from "react-native-svg";

export type IconName =
  | "back" | "bell" | "home" | "map" | "plus" | "feed" | "user" | "spark"
  | "search" | "heart" | "comment" | "check" | "bookmark" | "share" | "plusCircle" | "undo";

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  const stroke = { stroke: color, strokeWidth: 2, fill: "none" } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "back" && <Path d="M15 5l-7 7 7 7" {...stroke} strokeWidth={2.2} strokeLinecap="round" />}
      {name === "bell" && (
        <>
          <Path d="M6 16V11a6 6 0 1112 0v5l2 2H4z" {...stroke} />
          <Path d="M10 20a2 2 0 004 0" {...stroke} />
        </>
      )}
      {name === "home" && <Path d="M4 11l8-7 8 7v9H4z" {...stroke} />}
      {name === "map" && (
        <>
          <Path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" {...stroke} />
          <Circle cx={12} cy={10} r={2.5} {...stroke} />
        </>
      )}
      {name === "plus" && <Path d="M12 5v14M5 12h14" {...stroke} strokeWidth={2.6} strokeLinecap="round" />}
      {name === "feed" && (
        <>
          <Rect x={4} y={4} width={16} height={16} rx={3} {...stroke} />
          <Path d="M4 15l4-4 5 5 3-3 4 4" {...stroke} />
        </>
      )}
      {name === "user" && (
        <>
          <Circle cx={12} cy={8} r={4} {...stroke} />
          <Path d="M4 21c1-4 4-6 8-6s7 2 8 6" {...stroke} />
        </>
      )}
      {name === "spark" && <Path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" {...stroke} />}
      {name === "search" && (
        <>
          <Circle cx={11} cy={11} r={7} {...stroke} />
          <Path d="M20 20l-4-4" {...stroke} strokeLinecap="round" />
        </>
      )}
      {name === "heart" && (
        <Path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" {...stroke} />
      )}
      {name === "comment" && <Path d="M4 5h16v11H9l-5 4z" {...stroke} strokeLinejoin="round" />}
      {name === "share" && <Path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" {...stroke} strokeLinejoin="round" />}
      {name === "plusCircle" && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M12 8v8M8 12h8" {...stroke} strokeLinecap="round" />
        </>
      )}
      {name === "undo" && <Path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2" {...stroke} strokeLinecap="round" />}
      {name === "bookmark" && <Path d="M6 4h12v16l-6-4-6 4z" {...stroke} strokeLinejoin="round" />}
      {name === "check" && <Path d="M5 12l5 5 9-10" {...stroke} strokeWidth={2.6} strokeLinecap="round" />}
    </Svg>
  );
}
