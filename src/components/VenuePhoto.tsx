import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import type { Category } from "../../convex/lib/contract";
import { radius } from "../theme";
import { Photo } from "./Photo";

/**
 * The picture of a place at a fixed height. Give it the photo (`uri`) and the `category` when you
 * have them; with only a `hue` it draws the calm category panel. Same props as before, plus the
 * optional ones. For other shapes (aspect ratios, overlays) use `Photo` directly.
 */
export function VenuePhoto({
  hue,
  height,
  style,
  uri,
  category,
  scrim,
  deep,
  children,
}: {
  hue: number;
  height: number;
  style?: StyleProp<ViewStyle>;
  uri?: string | null;
  category?: Category;
  scrim?: boolean | "bottom" | "hero" | "top";
  /** White text sits on it: a deep tint when there is no picture. */
  deep?: boolean;
  children?: ReactNode;
}) {
  return (
    <Photo uri={uri} category={category} hue={hue} height={height} round={radius.md} scrim={scrim} deep={deep} style={style}>
      {children}
    </Photo>
  );
}
