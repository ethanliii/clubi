import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, spacing } from "../theme";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export type EmptyStateProps = {
  title: string;
  body?: string;
  icon?: IconName;
  /** The button's label. Shown only together with `onAction`. */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** What a screen shows when a list is empty or the thing is gone: a sentence, and maybe one button. */
export function EmptyState({ title, body, icon, actionLabel, onAction, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      {icon ? (
        <View style={styles.icon}>
          <Icon name={icon} size={26} color={colors.low} />
        </View>
      ) : null}
      <Text variant="headline" center style={styles.title}>
        {title}
      </Text>
      {body ? (
        <Text muted center style={styles.body}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} accessibilityLabel={actionLabel} size="md" onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xxl + spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  // The icon stands on its own: no disc behind it.
  icon: { marginBottom: spacing.sm },
  title: { fontSize: 18, lineHeight: 24, fontWeight: "600", letterSpacing: -0.2, maxWidth: 300 },
  body: { fontSize: 15, lineHeight: 21, maxWidth: 290 },
  button: { marginTop: spacing.lg, width: "auto", minWidth: 168 },
});
