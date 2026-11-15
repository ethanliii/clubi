import { useMutation } from "convex/react";
import { useToast } from "../../components";
import { api, type NotifPrefs, type Visibility } from "../../lib/api";
import { errorMessage } from "../../lib/errors";

export type SettingsChange = {
  defaultVisibility?: Visibility;
  discoverable?: boolean;
  /** Always the whole object, all six switches. */
  notifPrefs?: NotifPrefs;
};

/**
 * Save a switch or a chip the moment it is tapped.
 * The screen shows the new value right away (Convex's optimistic update on `settings.get`); if the
 * backend refuses, Convex puts the old value back and the reason is shown in a toast.
 */
export function useSettingsToggle() {
  const toast = useToast();
  const update = useMutation(api.settings.update).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.settings.get, {});
    if (current === undefined || current === null) return;
    localStore.setQuery(
      api.settings.get,
      {},
      {
        ...current,
        defaultVisibility: args.defaultVisibility ?? current.defaultVisibility,
        discoverable: args.discoverable ?? current.discoverable,
        notifPrefs: { ...current.notifPrefs, ...args.notifPrefs },
      },
    );
  });
  return async (change: SettingsChange) => {
    try {
      await update(change);
    } catch (error) {
      toast(errorMessage(error), "error");
    }
  };
}
