import * as ImagePicker from "expo-image-picker";
import type { Id } from "../../convex/_generated/dataModel";

export type PickedPhoto = { uri: string; mimeType?: string };

/**
 * Open the photo library and return the picked photo, or null when the user backs out.
 * Call it straight from a button press (browsers only open the picker after a tap).
 */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, mimeType: asset.mimeType ?? undefined };
}

/**
 * Send a picked photo to Convex file storage and return its storage id.
 * `uploadUrl` comes from `api.posts.generateUploadUrl` or `api.settings.generateAvatarUploadUrl`.
 * Pass the id on to `rankings.rank` (photoStorageId), `posts.attachPhoto` or `settings.setAvatar`.
 */
export async function uploadPhoto(uploadUrl: string, photo: PickedPhoto): Promise<Id<"_storage">> {
  const blob = await (await fetch(photo.uri)).blob();
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": photo.mimeType ?? blob.type ?? "image/jpeg" },
    body: blob,
  });
  if (!response.ok) throw new Error("The photo could not be uploaded. Try again.");
  const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
