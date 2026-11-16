import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Constants from "expo-constants";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Header, Screen, Skeleton, Text, useToast } from "../components";
import {
  DeleteAccountSheet,
  PasswordSheet,
  ProfileForm,
  ROW_INSET,
  Segmented,
  SettingsGroup,
  SettingsRow,
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

const VERSION = Constants.expoConfig?.version;

/** Profile, privacy, notifications and account, from `api.settings.get`. Switches and the visibility choice save on tap. */
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
      <Header title="Settings" />
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {/* null only while signing out or after deleting the account; the gate moves the user on. */}
        {settings === undefined || settings === null ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Loading" style={styles.loading}>
            <View style={styles.loadingFace}>
              <Skeleton width={96} height={96} round={48} />
              <Skeleton width={140} height={20} />
            </View>
            <Skeleton height={200} round={radius.lg} />
            <Skeleton height={150} round={radius.lg} />
            <Skeleton height={260} round={radius.lg} />
          </View>
        ) : (
          <>
            <ProfileForm settings={settings} />

            <SettingsGroup title="Privacy">
              <View style={styles.choice}>
                <View style={styles.choiceText}>
                  <Text variant="bodyLg">Who sees my posts</Text>
                  <Text variant="caption" muted>
                    You can change it on each post.
                  </Text>
                </View>
                <Segmented
                  options={VISIBILITY}
                  value={settings.defaultVisibility}
                  onChange={(defaultVisibility) => {
                    if (settings.defaultVisibility !== defaultVisibility) void toggle({ defaultVisibility });
                  }}
                />
              </View>
              <SwitchRow
                label="Show me in search and suggestions"
                value={settings.discoverable}
                onValueChange={(discoverable) => void toggle({ discoverable })}
              />
            </SettingsGroup>

            <SettingsGroup title="Notifications">
              {NOTIFICATIONS.map((item) => (
                <SwitchRow
                  key={item.key}
                  label={item.label}
                  value={settings.notifPrefs[item.key]}
                  onValueChange={(on) => void toggle({ notifPrefs: { ...settings.notifPrefs, [item.key]: on } })}
                />
              ))}
            </SettingsGroup>

            <SettingsGroup
              title="Location"
              footer="Puts you at the demo spot in San Francisco. It stays on while your real location isn't available."
            >
              <SwitchRow label="Demo location" value={isDemo} onValueChange={setDemo} />
            </SettingsGroup>

            <SettingsGroup title="Account">
              <SettingsRow label="Username" value={`@${settings.username}`} />
              <SettingsRow label="Change password" onPress={() => setPasswordOpen(true)} />
            </SettingsGroup>

            {VERSION ? (
              <SettingsGroup title="About">
                <SettingsRow label="Version" value={VERSION} />
              </SettingsGroup>
            ) : null}

            <SettingsGroup>
              <SettingsRow label="Sign out" tone="action" chevron={false} disabled={signingOut} onPress={() => void onSignOut()} />
            </SettingsGroup>

            <View style={styles.apart}>
              <SettingsGroup footer="Removes your rankings, posts and friends for good.">
                <SettingsRow label="Delete account" tone="danger" chevron={false} onPress={() => setDeleteOpen(true)} />
              </SettingsGroup>
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
  content: { gap: spacing.xl + spacing.sm, paddingBottom: spacing.xxl * 2 },
  loading: { gap: spacing.xl },
  loadingFace: { alignItems: "center", gap: spacing.md, paddingBottom: spacing.sm },
  choice: { gap: spacing.md, paddingHorizontal: ROW_INSET, paddingTop: spacing.md, paddingBottom: spacing.md + 2 },
  choiceText: { gap: 2 },
  apart: { marginTop: spacing.lg },
});
