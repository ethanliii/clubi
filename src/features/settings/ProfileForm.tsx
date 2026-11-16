import { useMutation } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Button, Icon, Loading, Text, useToast } from "../../components";
import { api, type SettingsResult } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { pickPhoto, uploadPhoto } from "../../lib/photos";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, spacing } from "../../theme";
import { FieldRow } from "./FieldRow";
import { SettingsGroup } from "./Group";

type Field = "displayName" | "bio" | "homeCity" | "birthday";
const FIELDS: Field[] = ["displayName", "bio", "homeCity", "birthday"];
// The same limits the backend enforces, so the box stops before the backend has to say no.
const DISPLAY_NAME_MAX = 40;
const BIO_MAX = 160;
const HOME_CITY_MAX = 60;
const AVATAR = 96;

/** The photo at the top; tapping it is "Change photo": pick, upload to Convex storage, then `settings.setAvatar`. */
function AvatarPicker({ settings }: { settings: SettingsResult }) {
  const toast = useToast();
  const generateUploadUrl = useMutation(api.settings.generateAvatarUploadUrl);
  const setAvatar = useMutation(api.settings.setAvatar);
  const [uploading, setUploading] = useState(false);

  const change = async () => {
    try {
      const photo = await pickPhoto();
      if (photo === null) return;
      setUploading(true);
      const storageId = await uploadPhoto(await generateUploadUrl(), photo);
      await setAvatar({ storageId });
      toast("Photo updated", "success");
    } catch (error) {
      toast(errorMessage(error, "The photo could not be uploaded. Try again."), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change photo"
        disabled={uploading}
        onPress={() => void change()}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Avatar name={settings.displayName} uri={settings.avatarUrl} size={AVATAR} />
        {uploading ? (
          <View style={styles.avatarBusy}>
            <Loading compact />
          </View>
        ) : (
          <View style={styles.camera}>
            <Icon name="camera" size={16} color={colors.fg} />
          </View>
        )}
      </Pressable>
      <View style={styles.who}>
        <Text variant="headline" center numberOfLines={1}>
          {settings.displayName}
        </Text>
        <Text muted center numberOfLines={1}>{`@${settings.username}`}</Text>
      </View>
    </View>
  );
}

/**
 * Photo, display name, bio, home city and birthday. "Save" appears once something is edited and
 * sends only the fields that changed to `api.settings.update`. What is typed lives here until then; everything else is the backend's.
 */
export function ProfileForm({ settings }: { settings: SettingsResult }) {
  const [draft, setDraft] = useState<Partial<Record<Field, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const save = useMutationToast(api.settings.update, { success: "Saved" });

  const saved = (field: Field) => settings[field] ?? "";
  const value = (field: Field) => draft[field] ?? saved(field);
  const changed = FIELDS.filter((field) => draft[field] !== undefined && draft[field].trim() !== saved(field));
  const edit = (field: Field) => (text: string) => {
    setDraft((current) => ({ ...current, [field]: text }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const onSave = async () => {
    const problems: Partial<Record<Field, string>> = {};
    const change: Partial<Record<Field, string>> = {};
    for (const field of changed) change[field] = value(field).trim();
    if (change.displayName !== undefined && change.displayName === "") {
      problems.displayName = "Your name can't be empty.";
    }
    if (change.birthday !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(change.birthday)) {
      problems.birthday = "Write it like 2004-10-23.";
    }
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    const result = await save.run(change);
    if (result !== undefined) setDraft({});
  };

  return (
    <View style={styles.form}>
      <AvatarPicker settings={settings} />
      <SettingsGroup title="Profile">
        <FieldRow
          label="Name"
          accessibilityLabel="Display name"
          placeholder="What friends see"
          maxLength={DISPLAY_NAME_MAX}
          value={value("displayName")}
          onChangeText={edit("displayName")}
          error={errors.displayName}
        />
        <FieldRow
          label="Bio"
          placeholder="A line about your nights out"
          multiline
          maxLength={BIO_MAX}
          value={value("bio")}
          onChangeText={edit("bio")}
          hint={draft.bio !== undefined ? `${value("bio").length}/${BIO_MAX}` : undefined}
          error={errors.bio}
        />
        <FieldRow
          label="Home city"
          placeholder="Where you're a local"
          maxLength={HOME_CITY_MAX}
          value={value("homeCity")}
          onChangeText={edit("homeCity")}
          error={errors.homeCity}
        />
        <FieldRow
          label="Birthday"
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          value={value("birthday")}
          onChangeText={edit("birthday")}
          error={errors.birthday}
        />
      </SettingsGroup>
      {changed.length > 0 ? (
        <Button title="Save" accessibilityLabel="Save" loading={save.pending} onPress={() => void onSave()} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  header: { alignItems: "center", gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  pressed: { opacity: 0.7 },
  avatarBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: AVATAR / 2,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  camera: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.raised,
    borderWidth: 3,
    borderColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  who: { alignItems: "center", gap: 2, alignSelf: "stretch" },
});
