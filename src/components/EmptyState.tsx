import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "../theme";
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
          <Icon name={icon} size={22} color={colors.muted} />
        </View>
      ) : null}
      <Text variant="title" center>
        {title}
      </Text>
      {body ? (
        <Text muted center>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} accessibilityLabel={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.raised,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  button: { marginTop: spacing.md },
});
