import { StyleSheet, View } from "react-native";
import { Skeleton } from "../../components";
import { spacing } from "../../theme";

/** A profile that is still loading, in the shape of the real one. */
export function ProfileSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.wrap}>
      <Skeleton width={80} height={80} round={40} />
      <View style={styles.lines}>
        <Skeleton width="55%" height={28} />
        <Skeleton width="40%" height={14} />
      </View>
      <Skeleton width="70%" height={14} />
      <View style={styles.meters}>
        <Skeleton width="46%" height={30} />
        <Skeleton width="46%" height={30} />
      </View>
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.row}>
          <Skeleton width={56} height={56} round={12} />
          <View style={styles.lines}>
            <Skeleton width="60%" height={15} />
            <Skeleton width="35%" height={11} />
          </View>
          <Skeleton width={40} height={26} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  lines: { flex: 1, gap: spacing.sm },
  meters: { flexDirection: "row", justifyContent: "space-between" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
