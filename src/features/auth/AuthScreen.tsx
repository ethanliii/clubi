import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme";
import { VideoBackground } from "../onboarding/VideoBackground";

/**
 * The sign-up and sign-in screen: the welcome footage carries on behind a scrim that is dark where
 * the form is, lets the video through below it, and closes again at the foot of the screen (where
 * the clips carry burned-in captions). The form sits at the top of the screen so the
 * button under it stays clear of the keyboard. A tap on a
 * button lands while the keyboard is up (without `keyboardShouldPersistTaps` the first tap only
 * closes the keyboard), and on iOS the form scrolls clear of the keyboard on a short phone.
 */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <VideoBackground />
      <LinearGradient
        colors={[
          "rgba(11,10,15,0.86)",
          "rgba(11,10,15,0.8)",
          "rgba(11,10,15,0.42)",
          "rgba(11,10,15,0.5)",
          "rgba(11,10,15,0.94)",
          "rgba(11,10,15,0.97)",
        ]}
        locations={[0, 0.48, 0.66, 0.77, 0.86, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.fill} edges={["top", "bottom"]}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24 },
});
