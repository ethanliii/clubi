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
          <Icon name={icon} size={20} color={colors.muted} />
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
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  button: { marginTop: spacing.md, maxWidth: 360 },
});
