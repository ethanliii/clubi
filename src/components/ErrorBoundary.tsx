import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, spacing } from "../theme";
import { Button } from "./Button";
import { Text } from "./Text";

type Props = {
  children: ReactNode;
  /** Replace the default "Something went wrong" screen. `retry` draws the children again. */
  fallback?: (error: Error, retry: () => void) => ReactNode;
};

type State = { error: Error | null };

/**
 * Catches a crash while drawing anything inside it and shows a retry screen instead of a blank app.
 * The root layout wraps every route in one. Wrap a risky part of a screen in another to keep the rest alive.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Screen crashed:", error, info.componentStack);
  }

  retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error === null) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.retry);
    return (
      <View style={styles.wrap}>
        <Text variant="heading" center>
          Something went wrong
        </Text>
        <Text muted center>
          {error.message || "This screen could not be shown."}
        </Text>
        <Button title="Try again" accessibilityLabel="Try again" onPress={this.retry} style={styles.button} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  button: { marginTop: spacing.md, maxWidth: 320 },
});
