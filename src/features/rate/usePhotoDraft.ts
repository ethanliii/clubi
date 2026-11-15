import { useMutation } from "convex/react";
import { useCallback, useRef, useState } from "react";
import { useToast } from "../../components";
import { api, type Id } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { pickPhoto, uploadPhoto } from "../../lib/photos";

/** The photo being added to a ranking. `storageId` is null while it is still uploading. */
export type DraftPhoto = { uri: string; storageId: Id<"_storage"> | null };

/**
 * "Add a photo" for the rank flow: open the picker, show the photo at once, upload it in the
 * background (docs/CONTRACT.md, "Photo after a rating") and keep the storage id for `rankings.rank`.
 *
 * Every pick and every "Remove" gets a new ticket, so an upload that finishes after the user has
 * removed or replaced the photo is ignored. Nothing here waits on the picker closing: a browser
 * does not always say when its file dialog was cancelled.
 */
export function usePhotoDraft() {
  const generateUploadUrl = useMutation(api.posts.generateUploadUrl);
  const toast = useToast();
  const [photo, setPhoto] = useState<DraftPhoto | null>(null);
  const ticket = useRef(0);

  const add = useCallback(async () => {
    const mine = ++ticket.current;
    try {
      const picked = await pickPhoto();
      if (picked === null || ticket.current !== mine) return;
      setPhoto({ uri: picked.uri, storageId: null });
      const storageId = await uploadPhoto(await generateUploadUrl(), picked);
      if (ticket.current !== mine) return;
      setPhoto({ uri: picked.uri, storageId });
    } catch (error) {
      if (ticket.current !== mine) return;
      setPhoto(null);
      toast(errorMessage(error, "The photo could not be added. Try again."), "error");
    }
  }, [generateUploadUrl, toast]);

  const remove = useCallback(() => {
    ticket.current += 1;
    setPhoto(null);
  }, []);

  return { photo, uploading: photo !== null && photo.storageId === null, add, remove };
}
