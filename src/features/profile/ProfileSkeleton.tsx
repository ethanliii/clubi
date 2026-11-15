import { StyleSheet, View } from "react-native";
import { Skeleton, SkeletonRows } from "../../components";
import { radius, spacing } from "../../theme";

/** A profile that is still loading, in the shape of the real one. */
export function ProfileSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.wrap}>
      <View style={styles.top}>
        <Skeleton width={86} height={86} round={43} />
        <View style={styles.names}>
          <Skeleton width="60%" height={22} />
          <Skeleton width="80%" height={34} />
        </View>
      </View>
      <Skeleton width="45%" height={14} />
      <Skeleton height={48} round={radius.lg} />
      <Skeleton height={120} round={radius.lg} />
      <SkeletonRows count={3} avatar={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  names: { flex: 1, gap: spacing.sm },
});
