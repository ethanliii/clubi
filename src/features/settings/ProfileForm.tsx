import { useMutation } from "convex/react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Button, Icon, Loading, Text, useToast } from "../../components";
import { api, type SettingsResult } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { pickPhoto, uploadPhoto } from "../../lib/photos";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors, palette, spacing } from "../../theme";
import { FieldRow } from "./FieldRow";
import { SettingsGroup } from "./Group";

type Field = "displayName" | "bio" | "homeCity" | "birthday";
const FIELDS: Field[] = ["displayName", "bio", "homeCity", "birthday"];
// The same limits the backend enforces, so the box stops before the backend has to say no.
const DISPLAY_NAME_MAX = 40;
const BIO_MAX = 160;
const HOME_CITY_MAX = 60;
const AVATAR = 72;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2000-01-01" from the backend, shown as "Jan 1, 2000". Anything else is shown as it is. */
function prettyBirthday(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}, ${match[1]}` : iso;
}

/** What was typed ("Oct 23, 2004", "10/23/2004" or "2004-10-23") as the backend's "2004-10-23"; null when it is not a date. */
function parseBirthday(text: string): string | null {
  const clean = text.trim();
  let year = 0;
  let month = 0;
  let day = 0;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(clean);
  if (match) [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(clean))) {
    [month, day, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(clean))) {
    month = MONTHS.findIndex((name) => match![1].toLowerCase().startsWith(name.toLowerCase())) + 1;
    [day, year] = [Number(match[2]), Number(match[3])];
  } else return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change photo"
      disabled={uploading}
      onPress={() => void change()}
      style={({ pressed }) => [styles.header, pressed && styles.pressed]}
    >
      <View>
        <Avatar name={settings.displayName} uri={settings.avatarUrl} size={AVATAR} />
        {uploading ? (
          <View style={styles.avatarBusy}>
            <Loading compact />
          </View>
        ) : (
          <View style={styles.camera}>
            <Icon name="camera" size={13} color={colors.white} />
          </View>
        )}
      </View>
      <Text style={styles.change}>Change photo</Text>
    </Pressable>
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
  const value = (field: Field) => draft[field] ?? (field === "birthday" ? prettyBirthday(saved(field)) : saved(field));
  // A birthday is compared as the date it means, so retyping the same day in another style changes nothing.
  const meant = (field: Field, text: string) => (field === "birthday" ? (parseBirthday(text) ?? text.trim()) : text.trim());
  const changed = FIELDS.filter((field) => draft[field] !== undefined && meant(field, draft[field]) !== saved(field));
  const edit = (field: Field) => (text: string) => {
    setDraft((current) => ({ ...current, [field]: text }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const onSave = async () => {
    const problems: Partial<Record<Field, string>> = {};
    const change: Partial<Record<Field, string>> = {};
    for (const field of changed) change[field] = meant(field, value(field));
    if (change.displayName !== undefined && change.displayName === "") {
      problems.displayName = "Your name can't be empty.";
    }
    if (change.birthday !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(change.birthday)) {
      problems.birthday = "Write it like Oct 23, 2004.";
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
          placeholder="Oct 23, 2004"
          autoCorrect={false}
          maxLength={20}
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
  form: { gap: spacing.xl },
  header: { alignSelf: "center", alignItems: "center", gap: spacing.sm, paddingTop: spacing.xs },
  pressed: { opacity: 0.7 },
  avatarBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: AVATAR / 2,
    backgroundColor: palette.backdrop,
    alignItems: "center",
    justifyContent: "center",
  },
  camera: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.fg,
    borderWidth: 3,
    borderColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  change: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: colors.fg },
});
