import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { ConvexReactClient, useConvexAuth, useMutation, useQuery } from "convex/react";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Button, FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "./convex/_generated/api";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

export default function App() {
  return (
    <ConvexAuthProvider
      client={convex}
      storage={secureStorage}
      api={{
        refreshSession: api.auth.refreshSession,
        signOut: api.auth.signOut,
        isAuthenticated: api.auth.isAuthenticated,
      }}
    >
      <View style={styles.container}>
        <Main />
        <StatusBar style="auto" />
      </View>
    </ConvexAuthProvider>
  );
}

function Main() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) {
    return <Text>Loading…</Text>;
  }
  return isAuthenticated ? <Moments /> : <SignIn />;
}

function SignIn() {
  const { signIn, pending: signingIn } = useSignInWithUsernamePassword(api.auth);
  const { signUp, pending: signingUp } = useSignUpWithUsernamePassword(api.auth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (run: typeof signIn | typeof signUp) => {
    setError(null);
    const result = await run({ username, password });
    if (result.status === "error") {
      setError(result.userError.error);
    }
  };

  const pending = signingIn || signingUp;
  return (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        autoComplete="username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Sign in" disabled={pending} onPress={() => submit(signIn)} />
      <Button title="Sign up" disabled={pending} onPress={() => submit(signUp)} />
    </View>
  );
}

function Moments() {
  const moments = useQuery(api.moments.listMine);
  const addMoment = useMutation(api.moments.add);
  const { signOut } = useAuthActions();
  const [text, setText] = useState("");

  return (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        placeholder="What's happening?"
        value={text}
        onChangeText={setText}
      />
      <Button
        title="Add moment"
        disabled={text.trim() === ""}
        onPress={async () => {
          await addMoment({ text: text.trim() });
          setText("");
        }}
      />
      <FlatList
        data={moments ?? []}
        keyExtractor={(moment) => moment._id}
        renderItem={({ item }) => <Text style={styles.moment}>{item.text}</Text>}
      />
      <Button title="Sign out" onPress={() => void signOut()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  form: {
    flex: 1,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
  },
  error: {
    color: "#c00",
  },
  moment: {
    paddingVertical: 8,
  },
});
