import { StyleSheet, View } from "react-native";
import { Skeleton, SkeletonRows } from "../../components";
import { radius, spacing } from "../../theme";

/** A profile that is still loading, in the shape of the real one. */
export function ProfileSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.wrap}>
      <View style={styles.top}>
        <Skeleton width={72} height={72} round={36} />
        <View style={styles.names}>
          <Skeleton width="60%" height={24} />
          <Skeleton width="40%" height={14} />
        </View>
      </View>
      <Skeleton height={64} round={radius.xl} />
      <Skeleton height={150} round={radius.xl} />
      <SkeletonRows count={3} avatar={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  names: { flex: 1, gap: spacing.sm },
});
