import { useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Icon, Text, type IconName } from "../../components";
import type { VenueDetail, Visibility } from "../../lib/api";
import { colors, fontWeight, radius, spacing } from "../../theme";
import { BusyButton, FlowScreen } from "./FlowScreen";
import { noFocusRing, type } from "./ui";
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
/** The counter stays out of the way until the note is nearly full. */
const COUNTER_FROM = CAPTION_MAX - 60;

const VISIBILITIES: { value: Visibility; label: string; icon: IconName }[] = [
  { value: "friends", label: "Friends", icon: "users" },
  { value: "public", label: "Public", icon: "globe" },
  { value: "private", label: "Only me", icon: "lock" },
];

/** What the user has filled in on this step. Kept by the flow, so going back loses nothing. */
export type Draft = {
  tags: string[];
  caption: string;
  /** null until the user taps one of the "Who sees it" choices. */
  visibility: Visibility | null;
};

export const EMPTY_DRAFT: Draft = { tags: [], caption: "", visibility: null };

/** Step 4. Tags, an optional photo, a note, who sees it, and "Post". */
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
  /** The choice drawn as picked. null on a re-rank the user has not touched: the post keeps its setting. */
  shownVisibility: Visibility | null;
  keepsVisibility: boolean;
  posting: boolean;
  onPost: () => void;
  onBack: () => void;
}) {
  const uploading = photo !== null && photo.storageId === null;
  // The note box grows with the note, so a long one is never scrolled inside a small box.
  const [noteHeight, setNoteHeight] = useState(TILE);
  const toggleTag = (tag: string) =>
    onChange({ ...draft, tags: draft.tags.includes(tag) ? draft.tags.filter((other) => other !== tag) : [...draft.tags, tag] });

  return (
    <FlowScreen
      title={venue.name}
      heading="What was it like?"
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
      <View style={styles.tags}>
        {TAGS.map((tag) => {
          const on = draft.tags.includes(tag);
          return (
            <Pressable
              key={tag}
              accessibilityRole="button"
              accessibilityLabel={tag}
              accessibilityState={{ selected: on, disabled: posting }}
              disabled={posting}
              onPress={() => toggleTag(tag)}
              style={({ pressed }) => [styles.tag, on && styles.tagOn, (pressed || posting) && styles.dimmed]}
            >
              <Text style={[styles.tagText, on && styles.tagTextOn]}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.composer}>
        {photo === null ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            disabled={posting}
            onPress={onAddPhoto}
            style={({ pressed }) => [styles.tile, styles.tileEmpty, (pressed || posting) && styles.dimmed]}
          >
            <Icon name="camera" size={24} color={colors.fg} />
            <Text style={styles.tileText}>Add a photo</Text>
          </Pressable>
        ) : (
          <View style={styles.tile}>
            <Image source={{ uri: photo.uri }} resizeMode="cover" accessibilityLabel="Your photo" style={styles.tileImage} />
            {uploading ? (
              <View style={styles.tileBusy}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove"
              disabled={posting}
              hitSlop={12}
              onPress={onRemovePhoto}
              style={({ pressed }) => [styles.remove, pressed && styles.dimmed]}
            >
              <Icon name="close" size={14} color={colors.white} />
            </Pressable>
          </View>
        )}
        <View style={styles.noteWrap}>
          <TextInput
            accessibilityLabel="Add a note (optional)"
            placeholder="Add a note"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            value={draft.caption}
            onChangeText={(caption) => onChange({ ...draft, caption: caption.slice(0, CAPTION_MAX) })}
            maxLength={CAPTION_MAX}
            multiline
            editable={!posting}
            onContentSizeChange={(event) => setNoteHeight(Math.max(TILE, Math.ceil(event.nativeEvent.contentSize.height) + NOTE_ROOM))}
            style={[styles.note, noFocusRing, { height: noteHeight }]}
          />
          {draft.caption.length >= COUNTER_FROM ? (
            <Text style={[type.meta, styles.counter]}>{`${draft.caption.length}/${CAPTION_MAX}`}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.who}>
        <Text style={type.meta}>Who sees it</Text>
        <View style={styles.segments}>
          {VISIBILITIES.map(({ value, label, icon }) => {
            const on = shownVisibility === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: on, disabled: posting }}
                disabled={posting}
                onPress={() => onChange({ ...draft, visibility: value })}
                style={({ pressed }) => [styles.segment, on && styles.segmentOn, (pressed || posting) && styles.dimmed]}
              >
                <Icon name={icon} size={16} color={on ? colors.bg : colors.muted} />
                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {keepsVisibility && shownVisibility === null ? (
          <Text style={type.meta}>Your post keeps its current setting unless you pick one.</Text>
        ) : null}
      </View>
    </FlowScreen>
  );
}

const TILE = 96;
// A browser measures the box's padding with the text; a phone measures the text alone.
const NOTE_ROOM = Platform.OS === "web" ? 0 : spacing.sm;

const styles = StyleSheet.create({
  dimmed: { opacity: 0.6 },

  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  tagOn: { backgroundColor: colors.fg },
  tagText: { fontSize: 15, lineHeight: 20, color: colors.fg },
  tagTextOn: { color: colors.bg, fontWeight: fontWeight.semibold },

  composer: {
    flexDirection: "row",
    gap: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  tile: { width: TILE, height: TILE, borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surface },
  tileEmpty: { alignItems: "center", justifyContent: "center", gap: spacing.xs + 2 },
  tileText: { fontSize: 12, lineHeight: 16, color: colors.muted },
  tileImage: { width: TILE, height: TILE },
  tileBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  remove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  noteWrap: { flex: 1 },
  note: {
    minHeight: TILE,
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    fontSize: 17,
    lineHeight: 23,
    color: colors.fg,
    textAlignVertical: "top",
  },
  counter: { textAlign: "right" },

  who: { gap: spacing.sm },
  segments: { flexDirection: "row", padding: 3, gap: 3, borderRadius: radius.lg + 3, backgroundColor: colors.surface },
  segment: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.lg,
  },
  segmentOn: { backgroundColor: colors.fg },
  segmentText: { fontSize: 14, lineHeight: 18, color: colors.muted, fontWeight: fontWeight.medium },
  segmentTextOn: { color: colors.bg, fontWeight: fontWeight.semibold },
});
