import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { api } from "../../convex/_generated/api";
import { BackButton, Button, Screen, Text } from "../components";
import { colors, radius, spacing } from "../theme";

export default function MomentsScreen() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  return (
    <Screen>
      <BackButton />
      <Text variant="heading">Moments</Text>
      {isLoading ? (
        <Text muted>Loading…</Text>
      ) : isAuthenticated ? (
        <Moments />
      ) : (
        <>
          <Text muted>Sign in to post moments to your feed.</Text>
          <Button title="Sign in" onPress={() => router.push("/sign-in")} />
        </>
      )}
    </Screen>
  );
}

function Moments() {
  const moments = useQuery(api.moments.listMine);
  const addMoment = useMutation(api.moments.add);
  const { signOut } = useAuthActions();
  const [text, setText] = useState("");

  return (
    <>
      <TextInput
        style={styles.input}
        placeholder="What's happening?"
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={setText}
      />
      <Button
        title="Add moment"
        disabled={text.trim() === ""}
        onPress={async () => {
          const submitted = text;
          await addMoment({ text: submitted.trim() });
          setText((current) => (current === submitted ? "" : current));
        }}
      />
      <View>
        {(moments ?? []).map((moment) => (
          <Text key={moment._id} style={styles.moment}>
            {moment.text}
          </Text>
        ))}
      </View>
      <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.fg,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  moment: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
});
