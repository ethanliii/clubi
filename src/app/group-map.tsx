/**
 * The group map: what works for a whole group, on a map. Opens as /group-map (asks who is going),
 * /group-map?tripId=<id> (a saved plan) or /group-map?memberIds=<id>,<id> (friends, nothing saved).
 * Build the address with `groupMapPath` from `src/features/groupmap/group.ts`.
 */
import { GroupMapScreen } from "../features/groupmap/GroupMapScreen";

export default GroupMapScreen;
