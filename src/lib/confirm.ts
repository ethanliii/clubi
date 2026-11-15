import { Alert, Platform } from "react-native";

export type ConfirmOptions = {
  title: string;
  message?: string;
  /** The label of the button that goes ahead. Default "OK". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button on iOS, for deletes. */
  destructive?: boolean;
};

/**
 * Ask "are you sure?" and resolve to true or false.
 * Native shows a system alert. Web uses the browser's confirm box, because `Alert.alert` does nothing on web.
 */
export function confirm({
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    const ask = (globalThis as { confirm?: (text: string) => boolean }).confirm;
    return Promise.resolve(ask ? ask(text) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
