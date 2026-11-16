import { useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Icon, Text, type IconName } from "../../components";
import { categoryLabel } from "../../lib/format";
import type { VenueDetail, Visibility } from "../../lib/api";
import { colors, fontWeight, palette, radius, spacing } from "../../theme";
import { BusyButton, FlowScreen } from "./FlowScreen";
import { noFocusRing, PlacePhoto, type } from "./ui";
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

type Open = "notes" | "labels" | "who" | null;

/** One line of the sheet: an icon, a label, an optional value, and a chevron. */
function Row({
  icon,
  label,
  value,
  open,
  disabled,
  last = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  /** undefined for a row that does not open in place. */
  open?: boolean;
  disabled: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && !open && styles.rowLine, pressed && styles.rowPressed]}
    >
      <Icon name={icon} size={22} color={colors.fg} />
      <Text numberOfLines={1} style={styles.rowLabel}>
        {label}
      </Text>
      {value ? (
        <Text numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      <Icon name={open ? "chevronDown" : "chevron"} size={16} color={colors.low} />
    </Pressable>
  );
}

/** Step 4. One sheet of rows: notes, photos, labels, who can see it. Then "Post". */
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
  const [open, setOpen] = useState<Open>(null);
  // The note box grows with the note, so a long one is never scrolled inside a small box.
  const [noteHeight, setNoteHeight] = useState(NOTE_MIN);
  const toggle = (row: Exclude<Open, null>) => setOpen(open === row ? null : row);
  const toggleTag = (tag: string) =>
    onChange({ ...draft, tags: draft.tags.includes(tag) ? draft.tags.filter((other) => other !== tag) : [...draft.tags, tag] });
  const note = draft.caption.trim();
  const who = VISIBILITIES.find(({ value }) => value === shownVisibility);

  return (
    <FlowScreen
      title="Add details"
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
      <View style={styles.place}>
        <PlacePhoto uri={venue.imageUrl} category={venue.category} height={56} width={56} round={radius.lg} />
        <View style={styles.placeText}>
          <Text numberOfLines={1} style={styles.placeName}>
            {venue.name}
          </Text>
          <Text numberOfLines={1} style={type.meta}>
            {categoryLabel(venue.category, venue.subcategory)}
          </Text>
        </View>
      </View>

      <View style={styles.sheet}>
        <Row
          icon="edit"
          label={note === "" ? "Add notes" : "Notes"}
          value={open === "notes" ? undefined : note}
          open={open === "notes"}
          disabled={posting}
          onPress={() => toggle("notes")}
        />
        {open === "notes" ? (
          <View style={[styles.panel, styles.rowLine]}>
            <TextInput
              accessibilityLabel="Add a note (optional)"
              placeholder="What stood out? Anything friends should know?"
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              value={draft.caption}
              onChangeText={(caption) => onChange({ ...draft, caption: caption.slice(0, CAPTION_MAX) })}
              maxLength={CAPTION_MAX}
              multiline
              autoFocus
              editable={!posting}
              onContentSizeChange={(event) =>
                setNoteHeight(Math.max(NOTE_MIN, Math.ceil(event.nativeEvent.contentSize.height) + NOTE_ROOM))
              }
              style={[styles.note, noFocusRing, { height: noteHeight }]}
            />
            {draft.caption.length >= COUNTER_FROM ? (
              <Text style={[type.meta, styles.counter]}>{`${draft.caption.length}/${CAPTION_MAX}`}</Text>
            ) : null}
          </View>
        ) : null}

        {photo === null ? (
          <Row icon="camera" label="Add photos" disabled={posting} onPress={onAddPhoto} />
        ) : (
          <View style={[styles.row, styles.rowLine]}>
            <Icon name="camera" size={22} color={colors.fg} />
            <Text numberOfLines={1} style={styles.rowLabel}>
              {uploading ? "Uploading photo…" : "1 photo"}
            </Text>
            <View style={styles.thumb}>
              <Image source={{ uri: photo.uri }} resizeMode="cover" accessibilityLabel="Your photo" style={styles.thumbImage} />
              {uploading ? (
                <View style={styles.thumbBusy}>
                  <ActivityIndicator size="small" color={colors.white} />
                </View>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove"
              disabled={posting}
              onPress={onRemovePhoto}
              style={({ pressed }) => [styles.remove, pressed && styles.dimmed]}
            >
              <Icon name="close" size={16} color={colors.muted} />
            </Pressable>
          </View>
        )}

        <Row
          icon="check"
          label={draft.tags.length === 0 ? "Add labels" : "Labels"}
          value={open === "labels" ? undefined : draft.tags.join(", ")}
          open={open === "labels"}
          disabled={posting}
          onPress={() => toggle("labels")}
        />
        {open === "labels" ? (
          <View style={[styles.panel, styles.tags, styles.rowLine]}>
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
        ) : null}

        <Row
          icon={who?.icon ?? "users"}
          label="Who can see this"
          value={who?.label ?? (keepsVisibility ? "Unchanged" : undefined)}
          open={open === "who"}
          disabled={posting}
          last
          onPress={() => toggle("who")}
        />
        {open === "who" ? (
          <View style={styles.whoPanel}>
            {VISIBILITIES.map(({ value, label, icon }) => {
              const on = shownVisibility === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: on, disabled: posting }}
                  disabled={posting}
                  onPress={() => {
                    onChange({ ...draft, visibility: value });
                    setOpen(null);
                  }}
                  style={({ pressed }) => [styles.choice, pressed && styles.rowPressed]}
                >
                  <Icon name={icon} size={18} color={colors.muted} />
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{label}</Text>
                  {on ? <Icon name="check" size={18} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
            {keepsVisibility && shownVisibility === null ? (
              <Text style={[type.meta, styles.keeps]}>Your post keeps its current setting unless you pick one.</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </FlowScreen>
  );
}

const NOTE_MIN = 88;
// A browser measures the box's padding with the text; a phone measures the text alone.
const NOTE_ROOM = Platform.OS === "web" ? 0 : spacing.sm;
const INDENT = 22 + spacing.md + 2;

const styles = StyleSheet.create({
  dimmed: { opacity: 0.6 },

  place: { flexDirection: "row", alignItems: "center", gap: spacing.md + 2 },
  placeText: { flex: 1, gap: 2 },
  placeName: { fontSize: 20, lineHeight: 25, fontWeight: "800", letterSpacing: -0.4, color: colors.fg },

  sheet: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md + 2, minHeight: 60 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowPressed: { backgroundColor: palette.field },
  rowLabel: { flexShrink: 0, fontSize: 17, lineHeight: 22, fontWeight: fontWeight.semibold, letterSpacing: -0.2, color: colors.fg },
  rowValue: { flex: 1, textAlign: "right", fontSize: 15, lineHeight: 20, color: colors.muted },

  panel: { paddingLeft: INDENT, paddingBottom: spacing.md + 2 },
  note: {
    minHeight: NOTE_MIN,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: palette.field,
    fontSize: 16,
    lineHeight: 22,
    color: colors.fg,
    textAlignVertical: "top",
  },
  counter: { textAlign: "right", paddingTop: spacing.xs },

  thumb: { width: 44, height: 44, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface, marginLeft: "auto" },
  thumbImage: { width: 44, height: 44 },
  thumbBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.backdrop,
  },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -12 },

  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: palette.field,
    alignItems: "center",
    justifyContent: "center",
  },
  tagOn: { backgroundColor: colors.fg },
  tagText: { fontSize: 14, lineHeight: 19, fontWeight: fontWeight.medium, color: colors.fg },
  tagTextOn: { color: colors.bg, fontWeight: fontWeight.semibold },

  whoPanel: { paddingLeft: INDENT, paddingBottom: spacing.sm },
  choice: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 },
  choiceText: { flex: 1, fontSize: 16, lineHeight: 21, color: colors.fg },
  choiceTextOn: { fontWeight: fontWeight.bold },
  keeps: { paddingVertical: spacing.sm },
});
