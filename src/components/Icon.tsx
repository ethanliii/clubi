import Svg, { Circle, G, Path, Rect } from "react-native-svg";

export type IconName =
  | "back"
  | "bell"
  | "home"
  | "map"
  | "plus"
  | "feed"
  | "user"
  | "spark"
  // Added for the functional screens, drawn in the same 24-unit, 2-wide stroke style.
  | "search"
  | "close"
  | "check"
  | "chevron"
  | "chevronDown"
  | "minus"
  | "heart"
  | "heartFilled"
  | "comment"
  | "send"
  | "share"
  | "more"
  | "gear"
  | "edit"
  | "trash"
  | "camera"
  | "bookmark"
  | "bookmarkFilled"
  | "star"
  | "starFilled"
  | "thumbUp"
  | "thumbDown"
  | "users"
  | "calendar"
  | "clock"
  | "music"
  | "ticket"
  | "navigate"
  | "locate"
  | "external"
  | "lock"
  | "globe"
  | "info"
  // Bryan's own extras
  | "plusCircle"
  | "undo";

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
      {name === "close" && <Path d="M6 6l12 12M18 6L6 18" {...stroke} strokeWidth={2.2} strokeLinecap="round" />}
      {name === "check" && (
        <Path d="M5 12l5 5 9-10" {...stroke} strokeWidth={2.6} strokeLinecap="round" />
      )}
      {name === "chevron" && <Path d="M9 5l7 7-7 7" {...stroke} strokeWidth={2.2} strokeLinecap="round" />}
      {name === "chevronDown" && <Path d="M5 9l7 7 7-7" {...stroke} strokeWidth={2.2} strokeLinecap="round" />}
      {name === "minus" && <Path d="M5 12h14" {...stroke} strokeWidth={2.6} strokeLinecap="round" />}
      {(name === "heart" || name === "heartFilled") && (
        <Path
          d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"
          {...stroke}
          fill={name === "heartFilled" ? color : "none"}
        />
      )}
      {name === "comment" && (
        <Path d="M4 5h16v11H9l-5 4z" {...stroke} strokeLinejoin="round" />
      )}
      {name === "send" && (
        <>
          <Path d="M20 4.5L4 11l6.5 2.5L13 20z" {...stroke} strokeLinejoin="round" />
          <Path d="M10.5 13.5L20 4.5" {...stroke} />
        </>
      )}
      {name === "share" && (
        <Path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" {...stroke} strokeLinejoin="round" />
      )}
      {name === "more" && (
        <>
          <Circle cx={6} cy={12} r={1.7} fill={color} />
          <Circle cx={12} cy={12} r={1.7} fill={color} />
          <Circle cx={18} cy={12} r={1.7} fill={color} />
        </>
      )}
      {name === "gear" && (
        <>
          <Circle cx={12} cy={12} r={3} {...stroke} />
          <Circle cx={12} cy={12} r={6.8} {...stroke} />
          <Path
            d="M12 2.5v2.7M12 18.8v2.7M2.5 12h2.7M18.8 12h2.7M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M5.3 18.7l1.9-1.9M16.8 7.2l1.9-1.9"
            {...stroke}
            strokeLinecap="round"
          />
        </>
      )}
      {name === "edit" && (
        <Path d="M5 19l.8-3.8L16.5 4.5l3 3L8.8 18.2zM14.5 6.5l3 3" {...stroke} strokeLinejoin="round" />
      )}
      {name === "trash" && (
        <Path
          d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7M10.5 10.5v6M13.5 10.5v6"
          {...stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {name === "camera" && (
        <>
          <Path d="M4 8h3.5l1.5-2.5h6L16.5 8H20v11H4z" {...stroke} strokeLinejoin="round" />
          <Circle cx={12} cy={13} r={3.2} {...stroke} />
        </>
      )}
      {(name === "bookmark" || name === "bookmarkFilled") && (
        <Path
          d="M6 4h12v16l-6-4-6 4z"
          {...stroke}
          strokeLinejoin="round"
          fill={name === "bookmarkFilled" ? color : "none"}
        />
      )}
      {(name === "star" || name === "starFilled") && (
        <Path
          d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"
          {...stroke}
          strokeLinejoin="round"
          fill={name === "starFilled" ? color : "none"}
        />
      )}
      {(name === "thumbUp" || name === "thumbDown") && (
        <G transform={name === "thumbDown" ? "rotate(180 12 12)" : undefined}>
          <Path
            d="M8 11l3.5-7a2 2 0 012 2.3L13 10h5a2 2 0 012 2.4l-1.2 5.6a2 2 0 01-2 1.6H8zM8 11H4.5v9H8"
            {...stroke}
            strokeLinejoin="round"
          />
        </G>
      )}
      {name === "users" && (
        <>
          <Circle cx={9} cy={8.5} r={3.2} {...stroke} />
          <Path d="M3 20c.6-3.4 2.9-5 6-5s5.4 1.6 6 5" {...stroke} strokeLinecap="round" />
          <Path d="M15.5 5.6a3.2 3.2 0 010 5.8M17.5 15.3c1.9.6 3.1 2.2 3.5 4.7" {...stroke} strokeLinecap="round" />
        </>
      )}
      {name === "calendar" && (
        <>
          <Rect x={4} y={5.5} width={16} height={14.5} rx={2.5} {...stroke} />
          <Path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" {...stroke} strokeLinecap="round" />
        </>
      )}
      {name === "clock" && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M12 7.5V12l3 2" {...stroke} strokeLinecap="round" />
        </>
      )}
      {name === "music" && (
        <>
          <Path d="M9 18V6l10-2v12" {...stroke} strokeLinejoin="round" />
          <Circle cx={6.8} cy={18} r={2.2} {...stroke} />
          <Circle cx={16.8} cy={16} r={2.2} {...stroke} />
        </>
      )}
      {name === "ticket" && (
        <Path
          d="M4 8a1 1 0 011-1h14a1 1 0 011 1v2a2 2 0 000 4v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2a2 2 0 000-4zM14 7.5v9"
          {...stroke}
          strokeLinejoin="round"
        />
      )}
      {name === "navigate" && <Path d="M20 4L4.5 10.5l6.5 2.5 2.5 6.5z" {...stroke} strokeLinejoin="round" />}
      {name === "locate" && (
        <>
          <Circle cx={12} cy={12} r={6} {...stroke} />
          <Path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5" {...stroke} strokeLinecap="round" />
        </>
      )}
      {name === "external" && (
        <Path d="M10 5H5v14h14v-5M13.5 4H20v6.5M20 4l-9 9" {...stroke} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {name === "lock" && (
        <>
          <Rect x={5.5} y={10.5} width={13} height={9.5} rx={2} {...stroke} />
          <Path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" {...stroke} />
        </>
      )}
      {name === "globe" && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path
            d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5z"
            {...stroke}
          />
        </>
      )}
      {name === "info" && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M12 11v5.5M12 7.5v.5" {...stroke} strokeLinecap="round" />
        </>
      )}
      {name === "plusCircle" && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M12 8v8M8 12h8" {...stroke} strokeLinecap="round" />
        </>
      )}
      {name === "undo" && <Path d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2" {...stroke} strokeLinecap="round" />}
    </Svg>
  );
}
