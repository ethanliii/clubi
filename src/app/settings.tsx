import { useAuthActions } from "@convex-dev/auth/react";
import { Button, PlaceholderScreen } from "../components";

export default function SettingsScreen() {
  const { signOut } = useAuthActions();
  return (
    <PlaceholderScreen title="Settings" description="Profile, privacy, notifications and account." back>
      <Button title="Sign out" accessibilityLabel="Sign out" variant="ghost" onPress={() => void signOut()} />
    </PlaceholderScreen>
  );
}
