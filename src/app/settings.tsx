import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { BackButton, Button, Chip, ChipRow, Screen, Skeleton, SkeletonRows, Text, useToast } from "../components";
import {
  DeleteAccountSheet,
  PasswordSheet,
  ProfileForm,
  SwitchRow,
  useSettingsToggle,
} from "../features/settings";
import { api, type NotifPrefs, type Visibility } from "../lib/api";
import { useDemoLocation } from "../lib/demoLocation";
import { errorMessage } from "../lib/errors";
import { radius, spacing } from "../theme";

const VISIBILITY: { value: Visibility; label: string }[] = [
  { value: "friends", label: "Friends" },
  { value: "public", label: "Public" },
  { value: "private", label: "Only me" },
];

const NOTIFICATIONS: { key: keyof NotifPrefs; label: string }[] = [
  { key: "friendPosts", label: "Friends' rankings" },
  { key: "friendRequests", label: "Friend requests" },
  { key: "eventsTonight", label: "Events tonight" },
  { key: "artistAlerts", label: "Artists I like" },
  { key: "tripUpdates", label: "Trips" },
  { key: "reactions", label: "Likes and comments" },
];

/** Profile, privacy, notifications and account, from `api.settings.get`. Switches and chips save on tap. */
export default function SettingsScreen() {
  const settings = useQuery(api.settings.get, {});
  const { signOut } = useAuthActions();
  const toggle = useSettingsToggle();
  const toast = useToast();
  const { isDemo, setDemo } = useDemoLocation();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Nothing navigates after signing out: the session gate shows Welcome.
  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      toast(errorMessage(error, "Could not sign out. Try again."), "error");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <Screen scroll={false}>
      <BackButton />
      <Text variant="heading" accessibilityRole="header">
        Settings
      </Text>
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* null only while signing out or after deleting the account; the gate moves the user on. */}
        {settings === undefined || settings === null ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.section}>
            <Skeleton width={86} height={86} round={43} />
            <Skeleton height={48} round={radius.lg} />
            <Skeleton height={96} round={radius.lg} />
            <Skeleton height={48} round={radius.lg} />
            <SkeletonRows count={4} avatar={false} />
          </View>
        ) : (
          <>
            <ProfileForm settings={settings} />

            <View style={styles.section}>
              <Text variant="label" accessibilityRole="header">
                Who sees my posts
              </Text>
              <ChipRow>
                {VISIBILITY.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    accessibilityLabel={option.label}
                    selected={settings.defaultVisibility === option.value}
                    onPress={() => {
                      if (settings.defaultVisibility !== option.value) void toggle({ defaultVisibility: option.value });
                    }}
                  />
                ))}
              </ChipRow>
              <Text variant="caption" muted>
                The starting choice for new posts. You can change it on each one.
              </Text>
            </View>

            <View>
              <SwitchRow
                label="Show me in search and suggestions"
                value={settings.discoverable}
                onValueChange={(discoverable) => void toggle({ discoverable })}
              />
            </View>

            <View style={styles.section}>
              <Text variant="label" accessibilityRole="header">
                Notifications
              </Text>
              <View>
                {NOTIFICATIONS.map((item) => (
                  <SwitchRow
                    key={item.key}
                    label={item.label}
                    value={settings.notifPrefs[item.key]}
                    onValueChange={(on) => void toggle({ notifPrefs: { ...settings.notifPrefs, [item.key]: on } })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text variant="label" accessibilityRole="header">
                Location
              </Text>
              <SwitchRow
                label="Demo location"
                hint="Pretend to be at the demo spot in San Francisco. Nothing is sent. It stays on while your real location isn't available."
                value={isDemo}
                onValueChange={setDemo}
              />
            </View>

            <View style={styles.section}>
              <Text variant="label" accessibilityRole="header">
                Account
              </Text>
              <Text muted>{`Signed in as @${settings.username}`}</Text>
              <Button
                title="Change password"
                accessibilityLabel="Change password"
                variant="ghost"
                onPress={() => setPasswordOpen(true)}
              />
              <Button
                title="Sign out"
                accessibilityLabel="Sign out"
                variant="ghost"
                disabled={signingOut}
                onPress={() => void onSignOut()}
              />
              <Button
                title="Delete account"
                accessibilityLabel="Delete account"
                variant="ghost"
                style={styles.danger}
                onPress={() => setDeleteOpen(true)}
              />
            </View>

            <PasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
            <DeleteAccountSheet
              visible={deleteOpen}
              onClose={() => setDeleteOpen(false)}
              username={settings.username}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroller: { flex: 1 },
  content: { gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  danger: { borderColor: "#d9364f" },
});
