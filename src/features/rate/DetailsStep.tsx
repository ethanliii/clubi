import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { Button, Chip, ChipRow, Text, TextField } from "../../components";
import type { VenueDetail, Visibility } from "../../lib/api";
import { colors, radius, spacing } from "../../theme";
import { BusyButton, FlowScreen } from "./FlowScreen";
import type { DraftPhoto } from "./usePhotoDraft";

/** The suggested tags from docs/UI-SPEC.md section 6, step 4. Tap only, no typing. */
export const TAGS = [
  "Great music",
  "Packed",
  "Chill",
  "Pricey",
  "Cheap drinks",
  "Good for groups",
  "Date spot",
  "Long line",
  "Great food",
  "Worth it",
  "Touristy",
  "Hidden gem",
] as const;

export const CAPTION_MAX = 280;

const VISIBILITIES: { value: Visibility; label: string }[] = [
  { value: "friends", label: "Friends" },
  { value: "public", label: "Public" },
  { value: "private", label: "Only me" },
];

/** What the user has filled in on this step. Kept by the flow, so going back loses nothing. */
export type Draft = {
  tags: string[];
  caption: string;
  /** null until the user taps one of the "Who sees it" chips. */
  visibility: Visibility | null;
};

export const EMPTY_DRAFT: Draft = { tags: [], caption: "", visibility: null };

/** Step 4. Tags, an optional photo, a caption, who sees it, and "Post". */
export function DetailsStep({
  venue,
  draft,
  onChange,
  photo,
  onAddPhoto,
  onRemovePhoto,
  shownVisibility,
  keepsVisibility,
  posting,
  onPost,
  onBack,
}: {
  venue: VenueDetail;
  draft: Draft;
  onChange: (draft: Draft) => void;
  photo: DraftPhoto | null;
  onAddPhoto: () => void;
  onRemovePhoto: () => void;
  /** The chip drawn as picked. null on a re-rank the user has not touched: the post keeps its setting. */
  shownVisibility: Visibility | null;
  keepsVisibility: boolean;
  posting: boolean;
  onPost: () => void;
  onBack: () => void;
}) {
  const uploading = photo !== null && photo.storageId === null;
  const toggleTag = (tag: string) =>
    onChange({ ...draft, tags: draft.tags.includes(tag) ? draft.tags.filter((other) => other !== tag) : [...draft.tags, tag] });

  return (
    <FlowScreen
      title="Add the details"
      heading={venue.name}
      onBack={onBack}
      footer={
        <>
          {uploading ? (
            <Text variant="caption" muted center>
              Your photo is still uploading…
            </Text>
          ) : null}
          <BusyButton title="Post" accessibilityLabel="Post" busy={posting} disabled={uploading} onPress={onPost} />
        </>
      }
    >
      <View style={styles.section}>
        <Text variant="label">What was it like?</Text>
        <ChipRow>
          {TAGS.map((tag) => (
            <Chip key={tag} label={tag} selected={draft.tags.includes(tag)} disabled={posting} onPress={() => toggleTag(tag)} />
          ))}
        </ChipRow>
      </View>

      <View style={styles.section}>
        <Text variant="label">Photo</Text>
        {photo === null ? (
          <Button title="Add a photo" accessibilityLabel="Add a photo" variant="ghost" disabled={posting} onPress={onAddPhoto} />
        ) : (
          <View style={styles.photoRow}>
            <View style={styles.thumb}>
              <Image source={{ uri: photo.uri }} resizeMode="cover" accessibilityLabel="Your photo" style={styles.thumbImage} />
              {uploading ? (
                <View style={styles.thumbBusy}>
                  <ActivityIndicator color={colors.white} />
                </View>
              ) : null}
            </View>
            <View style={styles.photoText}>
              <Text muted>{uploading ? "Uploading…" : "Photo added"}</Text>
              <Button
                title="Remove"
                accessibilityLabel="Remove"
                variant="ghost"
                disabled={posting}
                onPress={onRemovePhoto}
                style={styles.remove}
              />
            </View>
          </View>
        )}
      </View>

      <TextField
        label="Note"
        placeholder="Add a note (optional)"
        accessibilityLabel="Add a note (optional)"
        value={draft.caption}
        onChangeText={(caption) => onChange({ ...draft, caption: caption.slice(0, CAPTION_MAX) })}
        maxLength={CAPTION_MAX}
        multiline
        editable={!posting}
        hint={`${draft.caption.length}/${CAPTION_MAX}`}
      />

      <View style={styles.section}>
        <Text variant="label">Who sees it</Text>
        <ChipRow>
          {VISIBILITIES.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              selected={shownVisibility === value}
              disabled={posting}
              onPress={() => onChange({ ...draft, visibility: value })}
            />
          ))}
        </ChipRow>
        {keepsVisibility && shownVisibility === null ? (
          <Text variant="caption" muted>
            Your post keeps its current setting unless you pick one.
          </Text>
        ) : null}
      </View>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  photoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  thumb: { width: 96, height: 96, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.raised },
  thumbImage: { width: 96, height: 96 },
  thumbBusy: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  photoText: { flex: 1, gap: spacing.sm, alignItems: "flex-start" },
  remove: { width: "auto" },
});
