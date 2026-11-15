import { StyleSheet, View } from "react-native";
import { Text } from "../../components";
import { colors } from "../../theme";
import type { MapSurfaceProps } from "./types";

/** Web fallback: react-native-maps is native only. The ranked list in the sheet still works. */
export function MapSurface({ items }: MapSurfaceProps) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.box]}>
      <Text muted center>Map shows on iOS and Android. {items.length} places nearby, listed below.</Text>
    </View>
  );
}

const styles = StyleSheet.create({ box: { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: 24 } });
