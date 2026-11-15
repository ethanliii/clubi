import { useMutation } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, ChipRow, Icon, ListRow, Sheet, Text, TextField, useToast, type IconName } from "../../components";
import { api, type FeedItem, type Visibility } from "../../lib/api";
import { confirm } from "../../lib/confirm";
import { errorMessage } from "../../lib/errors";
import { pickPhoto, uploadPhoto } from "../../lib/photos";
import { useMutationToast } from "../../lib/useMutationToast";
import { colors } from "../../theme";
import { VISIBILITY_OPTIONS } from "./PostCard";

/** The backend's limits (`CAPTION_MAX` and `MAX_POST_PHOTOS` in convex/lib/social.ts). */
const CAPTION_MAX = 500;
const MAX_PHOTOS = 4;

type Mode = "menu" | "caption" | "visibility";

const TITLES: Record<Mode, string> = { menu: "Your post", caption: "Edit caption", visibility: "Who sees it" };

/**
 * The "⋯" sheet on my own post: "Edit caption", "Who sees it", "Add a photo", "Delete post".
 * Keep it mounted; it is open while `visible` is true. `post` is the live post, so what it shows
 * (the current caption, who sees it, how many photos) is always what the backend has.
 */
export function PostMenu({
  post,
  visible,
  onClose,
  onDeleted,
}: {
  post: FeedItem | null;
  visible: boolean;
  onClose: () => void;
  /** After "Delete post" worked, e.g. to leave the post's page. */
  onDeleted?: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("menu");
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const { run: update, pending: saving } = useMutationToast(api.posts.update);
  const { run: remove, pending: removing } = useMutationToast(api.posts.remove);
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const attachPhoto = useMutation(api.posts.attachPhoto);

  const close = () => {
    setMode("menu");
    onClose();
  };

  const body = () => {
    if (post === null) return null;
    const { postId } = post;
    const current = post.visibility ?? "friends";
    const photoCount = post.photoUrls.length;

    const saveCaption = async () => {
      // An empty caption clears it on the backend.
      const saved = await update({ postId, caption: draft });
      if (saved === undefined) return;
      toast("Caption saved", "success");
      close();
    };

    const setVisibility = async (visibility: Visibility) => {
      if (visibility === current) return;
      await update({ postId, visibility });
    };

    const addPhoto = async () => {
      // Straight from the tap: a browser only opens its file picker inside a tap.
      const photo = await pickPhoto();
      if (photo === null) return;
      setUploading(true);
      try {
        const storageId = await uploadPhoto(await generateUploadUrl({}), photo);
        await attachPhoto({ postId, storageId });
        toast("Photo added", "success");
        close();
      } catch (error) {
        toast(errorMessage(error), "error");
      } finally {
        setUploading(false);
      }
    };

    const deletePost = async () => {
      const sure = await confirm({
        title: "Delete post?",
        message: "Your ranking stays. Only the post is removed.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!sure) return;
      const removed = await remove({ postId });
      if (removed === undefined) return;
      toast("Post deleted", "success");
      close();
      onDeleted?.();
    };

    if (mode === "caption") {
      return (
        <>
          <TextField
            label="Caption"
            value={draft}
            onChangeText={setDraft}
            placeholder="Say something about it"
            maxLength={CAPTION_MAX}
            hint={`${draft.length}/${CAPTION_MAX}`}
            multiline
            autoFocus
          />
          <Button title="Save" accessibilityLabel="Save" disabled={saving} onPress={() => void saveCaption()} />
          <Button title="Cancel" accessibilityLabel="Cancel" variant="ghost" onPress={() => setMode("menu")} />
        </>
      );
    }

    if (mode === "visibility") {
      return (
        <>
          <ChipRow>
            {VISIBILITY_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                accessibilityLabel={option.label}
                selected={option.value === current}
                disabled={saving}
                leading={<Icon name={option.icon} size={15} color={option.value === current ? colors.white : colors.muted} />}
                onPress={() => void setVisibility(option.value)}
              />
            ))}
          </ChipRow>
          <Text variant="caption" muted>
            Friends: only people you are friends with. Public: anyone on clubi. Only me: nobody else.
          </Text>
          <Button title="Done" accessibilityLabel="Done" variant="ghost" onPress={close} />
        </>
      );
    }

    const full = photoCount >= MAX_PHOTOS;
    const visibilityLabel = VISIBILITY_OPTIONS.find((option) => option.value === current)?.label;
    return (
      <View>
        <MenuRow
          icon="edit"
          title="Edit caption"
          subtitle={post.caption}
          onPress={() => {
            setDraft(post.caption ?? "");
            setMode("caption");
          }}
        />
        <MenuRow icon="users" title="Who sees it" subtitle={visibilityLabel} onPress={() => setMode("visibility")} />
        <MenuRow
          icon="camera"
          title="Add a photo"
          subtitle={uploading ? "Uploading…" : `${photoCount} of ${MAX_PHOTOS} photos`}
          onPress={full || uploading ? undefined : () => void addPhoto()}
        />
        <MenuRow
          icon="trash"
          title="Delete post"
          subtitle="Your ranking stays"
          onPress={removing ? undefined : () => void deletePost()}
          last
        />
      </View>
    );
  };

  return (
    <Sheet visible={visible} onClose={close} title={TITLES[mode]}>
      {body()}
    </Sheet>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  last = false,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Left out while the row cannot be used (four photos already, an upload in flight). */
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      accessibilityLabel={title}
      left={
        <View style={styles.icon}>
          <Icon name={icon} size={18} color={onPress ? colors.fg : colors.muted} />
        </View>
      }
      onPress={onPress}
      divider={!last}
      style={onPress ? undefined : styles.off}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  off: { opacity: 0.5 },
});
