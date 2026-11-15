import { Stack } from "expo-router";
import { paths } from "../../lib/links";
import { useSession } from "../../state/session";
import { colors } from "../../theme";

/** Welcome is for signed-out people. The quiz and the taste card are for someone who just signed up. */
export default function OnboardingLayout() {
  const { gate, landing } = useSession();
  const takingQuiz = gate === "quiz" || gate === "tasteCard";
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Protected guard={!takingQuiz} redirectTo={paths.quiz}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>
      {/*
        The taste card shares the quiz's guard on purpose: the quiz may open it in the same tick
        that `users.saveQuiz` resolves, before this layout has re-rendered.
      */}
      <Stack.Protected guard={takingQuiz} redirectTo={gate === "ready" ? landing : paths.welcome}>
        <Stack.Screen name="quiz" />
        <Stack.Screen name="taste-card" />
      </Stack.Protected>
    </Stack>
  );
}
