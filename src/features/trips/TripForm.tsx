import { useQuery } from "convex/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, TextField } from "../../components";
import { api, type Id, type TripDetail } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { useMutationToast } from "../../lib/useMutationToast";
import { spacing } from "../../theme";
import { DateRangeField, type DateRange } from "./DateRangeField";
import { FriendChips, toggleId } from "./FriendChips";
import { VibeChips, type Vibe } from "./vibes";

const NAME_MAX = 60;
const CITY_MAX = 60;

/**
 * The "New trip" form, and the same fields again for "Edit trip" when `trip` is given.
 * New: `api.trips.create`, then `onCreated(tripId)`. Edit: `api.trips.update`, then `onSaved()`.
 */
export function TripForm({
  trip,
  onCreated,
  onSaved,
  onNavigate,
}: {
  trip?: TripDetail;
  onCreated?: (tripId: Id<"trips">) => void;
  onSaved?: () => void;
  /** Runs before the form sends the user elsewhere ("Find friends"), so the sheet can close. */
  onNavigate?: () => void;
}) {
  const editing = trip !== undefined;
  const [name, setName] = useState(trip?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [city, setCity] = useState(trip?.city ?? "");
  const [dates, setDates] = useState<DateRange>({ start: trip?.startDate, end: trip?.endDate });
  const [vibe, setVibe] = useState<string | undefined>(trip?.vibe);
  const [memberIds, setMemberIds] = useState<Id<"users">[]>([]);

  const { lat, lng, ready } = useDemoLocation();
  const friends = useQuery(api.friends.list, editing ? "skip" : {});
  const create = useMutationToast(api.trips.create);
  const update = useMutationToast(api.trips.update, { success: "Trip updated" });
  const pending = create.pending || update.pending;

  const pickVibe = (next: Vibe) => {
    // A new trip may go without a vibe, so tapping the selected one takes it off again.
    // A saved vibe can be changed but not removed.
    setVibe(!editing && vibe === next ? undefined : next);
  };

  const submit = async () => {
    const cleanName = name.trim();
    const cleanCity = city.trim();
    if (cleanName === "") {
      setNameError("Give your trip a name.");
      return;
    }
    setNameError(null);
    const shared = {
      name: cleanName,
      ...(dates.start !== undefined ? { startDate: dates.start } : {}),
      ...(dates.end !== undefined ? { endDate: dates.end } : {}),
      ...(vibe !== undefined ? { vibe } : {}),
    };
    if (trip !== undefined) {
      // An empty city clears it on the backend.
      const result = await update.run({ tripId: trip.tripId, ...shared, city: cleanCity });
      if (result !== undefined) onSaved?.();
      return;
    }
    const result = await create.run({
      ...shared,
      // With no city this is a night out around here: pin the trip to where I am, so everyone in
      // it gets the same picks. With a city the backend has no coordinates for it.
      ...(cleanCity !== "" ? { city: cleanCity } : ready ? { lat, lng } : {}),
      ...(memberIds.length > 0 ? { memberIds } : {}),
    });
    if (result !== undefined) onCreated?.(result.tripId);
  };

  return (
    <View style={styles.form}>
      <TextField
        label="Name"
        placeholder="Friday night"
        value={name}
        onChangeText={(text) => {
          setName(text);
          if (nameError) setNameError(null);
        }}
        error={nameError}
        maxLength={NAME_MAX}
        returnKeyType="done"
      />
      <TextField
        label="City"
        placeholder="Optional"
        hint={editing ? undefined : "Leave empty for a night out near you."}
        value={city}
        onChangeText={setCity}
        maxLength={CITY_MAX}
        autoCapitalize="words"
        returnKeyType="done"
      />
      <DateRangeField value={dates} onChange={setDates} allowClear={!editing} />
      <View style={styles.group}>
        <Text variant="label">Vibe</Text>
        <VibeChips value={vibe} onChange={pickVibe} />
      </View>
      {editing ? null : (
        <View style={styles.group}>
          <Text variant="label">{"Who's coming"}</Text>
          <FriendChips
            friends={friends?.friends}
            selected={memberIds}
            onToggle={(userId) => setMemberIds((current) => toggleId(current, userId))}
            onNavigate={onNavigate}
          />
        </View>
      )}
      <Button
        title={editing ? "Save" : "Create trip"}
        accessibilityLabel={editing ? "Save" : "Create trip"}
        disabled={pending}
        onPress={() => void submit()}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  group: { gap: spacing.sm },
  submit: { marginTop: spacing.xs },
});
