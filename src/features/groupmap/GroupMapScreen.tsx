/**
 * The group map: a full-screen map of what works for a whole group (a saved plan, or a few friends
 * picked just for this look). Every pin's score is the GROUP score from `api.discover.forGroup`.
 * The same picks are listed best first in the white panel at the bottom, each with every member's
 * own score. Opens as /group-map, /group-map?tripId=<id> or /group-map?memberIds=<id>,<id>.
 */
import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BackButton, Button, EmptyState, ErrorBoundary, Icon, SkeletonRows, Text } from "../../components";
import { MapCanvas, TILE_ATTRIBUTION } from "../map/MapCanvas";
import { MapSheet, type SheetHeights, type SheetSnap } from "../map/MapSheet";
import { PEEK_CARD_HEIGHT, PeekCard } from "../map/PeekCard";
import { api, type GroupItem, type NearbyItem, type PlanMember } from "../../lib/api";
import { useDemoLocation } from "../../lib/demoLocation";
import { errorMessage } from "../../lib/errors";
import { pluralize } from "../../lib/format";
import { openUrl, tripPath, venuePath } from "../../lib/links";
import { useKeptQuery } from "../../lib/useKeptQuery";
import { useMe } from "../../state/session";
import { colors, fontWeight, palette, radius, spacing } from "../../theme";
import { BAR_GAP, BAR_HEIGHT, CHIP_HEIGHT, GroupBar } from "./GroupBar";
import { GroupPicker } from "./GroupPicker";
import { AgreementHint, GROUP_ROW_HEIGHT, GroupRow, MemberChips } from "./GroupRow";
import { choiceKey, firstName, parseChoice, type GroupChoice } from "./group";

const NO_ITEMS: GroupItem[] = [];
const NO_MEMBERS: PlanMember[] = [];
/** Shown even before the first answer arrives: the credit is a licence requirement. */
const DATA_ATTRIBUTION = "© OpenStreetMap contributors";
const ATTRIBUTION_URL = "https://www.openstreetmap.org/copyright";

const GUTTER = spacing.lg - 2;
const TOP_GAP = spacing.sm;
/** The strip above the list (or the pin's card) that holds the credit and "Recenter". */
const FLOAT = 56;
/** The handle, the title and its line of detail. */
const SHEET_HEADER = 84;
const CARD_MARGIN = spacing.md;
/** The members' scores, shown on their own small card above the picked pin's card. */
const STRIP = 78;

function sheetHeights(screen: number, barBottom: number): SheetHeights {
  const full = Math.max(280, screen - barBottom - spacing.sm);
  const peek = Math.min(full, SHEET_HEADER + GROUP_ROW_HEIGHT + spacing.xs);
  const mid = Math.min(full, Math.max(peek, Math.round(screen * 0.5)));
  return { peek, mid, full };
}

export function GroupMapScreen() {
  const params = useLocalSearchParams<{ tripId?: string; memberIds?: string }>();
  const tripParam = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const membersParam = Array.isArray(params.memberIds) ? params.memberIds.join(",") : params.memberIds;
  const choice = useMemo(() => parseChoice(tripParam, membersParam), [tripParam, membersParam]);
  // Until it is opened or closed by hand, the sheet is open exactly when there is no group to show.
  const [picker, setPicker] = useState<boolean | null>(null);
  const pickerOpen = picker ?? choice === null;
  const key = choiceKey(choice);

  const openPicker = useCallback(() => setPicker(true), []);
  const choose = (next: GroupChoice) => {
    // The address is where the chosen group lives, so a reload or a shared link shows the same map.
    router.setParams(
      next.kind === "trip"
        ? { tripId: next.tripId, memberIds: undefined }
        : { tripId: undefined, memberIds: next.memberIds.join(",") },
    );
    setPicker(false);
  };

  return (
    <View style={styles.screen}>
      <ErrorBoundary
        key={key}
        fallback={(error, retry) => <Failed error={error} onRetry={retry} onChangeGroup={openPicker} />}
      >
        <GroupMap key={key} choice={choice} onChangeGroup={openPicker} />
      </ErrorBoundary>
      <GroupPicker
        key={`picker:${key}`}
        visible={pickerOpen}
        onClose={() => setPicker(false)}
        current={choice}
        onChoose={choose}
      />
    </View>
  );
}

/** The group could not be loaded (a link to a plan that never existed, the backend unreachable). */
function Failed({ error, onRetry, onChangeGroup }: { error: Error; onRetry: () => void; onChangeGroup: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.failed, { paddingTop: insets.top + TOP_GAP }]}>
      <BackButton style={styles.failedBack} />
      <View style={styles.failedBody}>
        <EmptyState
          icon="alert"
          title="We couldn't load this group"
          body={errorMessage(error)}
          actionLabel="Change group"
          onAction={onChangeGroup}
        />
        <Button title="Try again" accessibilityLabel="Try again" variant="quiet" size="md" onPress={onRetry} />
      </View>
    </View>
  );
}

function GroupMap({ choice, onChangeGroup }: { choice: GroupChoice | null; onChangeGroup: () => void }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const me = useMe();
  const { lat, lng, ready, isDemo } = useDemoLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [snap, setSnap] = useState<SheetSnap>("mid");
  const [measured, setMeasured] = useState<number | null>(null);
  // How far the list is scrolled: at its very top, a pull down moves the panel instead.
  const listOffset = useRef(0);

  const tripId = choice?.kind === "trip" ? choice.tripId : null;
  const friendIds = choice?.kind === "friends" ? choice.memberIds : null;
  // undefined while loading, null when the plan is gone or was never mine.
  const trip = useQuery(api.trips.get, tripId !== null ? { tripId } : "skip");
  const overview = useQuery(api.friends.list, friendIds !== null ? {} : "skip");

  // A plan with a place of its own is looked at from there; everything else from where I am.
  const spot = trip && trip.lat !== undefined && trip.lng !== undefined ? { lat: trip.lat, lng: trip.lng } : null;
  const canAsk = choice !== null && (ready || spot !== null);
  const group = useKeptQuery(
    api.discover.forGroup,
    !canAsk ? "skip" : tripId !== null ? { tripId, lat, lng } : { memberIds: friendIds ?? [], lat, lng },
    choiceKey(choice),
  );

  const items = group?.items ?? NO_ITEMS;
  const selected = selectedId === null ? null : (items.find((item) => item.id === selectedId) ?? null);
  const center = group?.center ?? spot ?? { lat, lng };

  // Who the picks are for. The backend's answer is the truth; until it lands, what the plan or the
  // friends list already says keeps the faces on screen.
  let members: PlanMember[] = NO_MEMBERS;
  if (group !== undefined && group.members.length > 0) members = group.members;
  else if (trip) members = trip.members.filter((member) => member.isOwner || member.status === "joined");
  else if (friendIds !== null && me !== undefined) {
    members = [me, ...(overview?.friends ?? []).filter((friend) => friendIds.includes(friend.userId))];
  }
  const others = members.filter((member) => member.userId !== me?.userId);
  const name =
    choice === null
      ? null
      : tripId !== null
        ? (trip?.name ?? "Plan")
        : others.length === 0
          ? "Just you"
          : `You + ${others.map((member) => firstName(member.displayName)).join(", ")}`;
  const barLoading = choice !== null && members.length === 0 && trip !== null && group === undefined;
  // Friends who were invited to the plan but have not joined: the backend leaves them out of the group.
  const waiting = trip ? trip.members.filter((member) => member.status === "invited" && !member.isOwner).length : 0;
  // A plan I was invited to and have not joined gives no group at all.
  const notJoined = tripId !== null && group !== undefined && group.members.length === 0;

  const barTop = insets.top + TOP_GAP;
  const barBottom = barTop + BAR_HEIGHT;
  const chipsBottom = barBottom + BAR_GAP + CHIP_HEIGHT;
  const height = measured ?? window.height;
  const heights = sheetHeights(height, barBottom);
  const covered = selected ? PEEK_CARD_HEIGHT + CARD_MARGIN + STRIP + spacing.sm : heights[snap === "full" ? "mid" : snap];
  const padding = { top: chipsBottom + spacing.sm, bottom: covered + FLOAT };

  const attribution = [DATA_ATTRIBUTION, TILE_ATTRIBUTION].filter(Boolean).join(" · ");
  const open = (item: NearbyItem) => router.push(venuePath(item.kind, item.id));
  const pick = (item: NearbyItem | null) => {
    // A second tap on the picked pin opens it, the same as tapping its card.
    if (item !== null && item.id === selectedId) open(item);
    else setSelectedId(item === null ? null : item.id);
  };
  const onSnap = useCallback((next: SheetSnap) => setSnap(next), []);

  const float = (
    <View style={styles.float} pointerEvents="box-none">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={attribution}
        hitSlop={{ top: 12, bottom: 8, left: 8, right: 8 }}
        onPress={() => void openUrl(ATTRIBUTION_URL)}
        style={styles.credit}
      >
        <Text numberOfLines={2} style={styles.creditText}>
          {attribution}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Recenter"
        hitSlop={4}
        onPress={() => setRecenterKey((value) => value + 1)}
        style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}
      >
        <Icon name="navigate" size={20} color={colors.accent} />
      </Pressable>
    </View>
  );

  const title =
    choice === null
      ? "Who's going?"
      : members.length > 2
        ? `Works for all ${members.length} of you`
        : members.length === 2
          ? "Works for both of you"
          : "Picks for the group";
  const detail =
    choice === null
      ? "Choose a plan or pick friends"
      : trip === null
        ? "This plan isn't available"
        : group === undefined
          ? "Finding what fits everyone…"
          : items.length === 0
            ? "Nothing yet"
            : [`${pluralize(items.length, "pick")} · Best first`, waiting > 0 ? `${waiting} invited, not counted yet` : ""]
                .filter((part) => part !== "")
                .join(" · ");

  let body;
  if (choice === null) {
    body = (
      <EmptyState
        icon="users"
        title="Pick a group"
        body="Choose a plan, or pick a few friends, and the map shows what fits all of you."
        actionLabel="Change group"
        onAction={onChangeGroup}
        style={styles.empty}
      />
    );
  } else if (trip === null) {
    body = (
      <EmptyState
        icon="alert"
        title="This plan isn't available"
        body="It may have been removed, or you're not part of it."
        actionLabel="Change group"
        onAction={onChangeGroup}
        style={styles.empty}
      />
    );
  } else if (group === undefined) {
    body = <SkeletonRows count={4} shape="square" />;
  } else if (notJoined && tripId !== null) {
    body = (
      <EmptyState
        icon="users"
        title="Join this plan to see its picks"
        body="Accept the invite and the map shows what fits the whole group."
        actionLabel="Open plan"
        onAction={() => router.push(tripPath(tripId))}
        style={styles.empty}
      />
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon="map"
        title="No picks that work for everyone nearby"
        body="Try a different group, or a plan somewhere else."
        actionLabel="Change group"
        onAction={onChangeGroup}
        style={styles.empty}
      />
    );
  } else {
    body = null;
  }

  return (
    <View style={styles.fill} onLayout={(event) => setMeasured(event.nativeEvent.layout.height)}>
      <MapCanvas
        items={items}
        center={center}
        user={ready ? { lat, lng } : null}
        userIsDemo={isDemo}
        selectedId={selected === null ? null : selectedId}
        onSelect={pick}
        recenterKey={recenterKey}
        padding={padding}
      />

      <MapSheet
        snap={snap}
        onSnap={onSnap}
        heights={heights}
        hidden={selected !== null}
        above={float}
        aboveHeight={FLOAT}
        listOffset={listOffset}
        header={
          <View style={styles.sheetHeader}>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            <Text numberOfLines={1} style={styles.detail}>
              {detail}
            </Text>
          </View>
        }
      >
        {body !== null ? (
          <View style={styles.sheetPad}>{body}</View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            // Below full height a drag on the list moves the panel; a phone only scrolls the list at full height.
            scrollEnabled={Platform.OS === "web" ? snap !== "peek" : snap === "full"}
            // The panel is always full height and slid down: pad by the part that hangs below the screen.
            contentContainerStyle={{ paddingBottom: heights.full - heights[snap] + spacing.lg + insets.bottom }}
            scrollEventThrottle={32}
            onScroll={(event) => {
              listOffset.current = event.nativeEvent.contentOffset.y;
            }}
            onScrollEndDrag={(event) => {
              // Pulling down past the top of the list at full height lets the map back in.
              if (snap === "full" && event.nativeEvent.contentOffset.y < -48) setSnap("mid");
            }}
            renderItem={({ item, index }) => (
              <GroupRow
                item={item}
                meId={me?.userId}
                last={index === items.length - 1}
                onPress={() => setSelectedId(item.id)}
              />
            )}
          />
        )}
      </MapSheet>

      {selected ? (
        <View style={styles.cardDock} pointerEvents="box-none">
          <View style={{ height: FLOAT }} pointerEvents="box-none">
            {float}
          </View>
          <View style={styles.cardWrap} pointerEvents="box-none">
            <View style={styles.strip}>
              <View style={styles.stripTop}>
                <Text numberOfLines={1} style={styles.stripTitle}>
                  How it scores for each of you
                </Text>
                <AgreementHint item={selected} />
              </View>
              <MemberChips item={selected} meId={me?.userId} style={styles.stripChips} />
            </View>
            <PeekCard key={selected.id} item={selected} onOpen={() => open(selected)} onClose={() => setSelectedId(null)} />
          </View>
        </View>
      ) : null}

      <GroupBar
        top={barTop}
        name={name}
        members={members}
        loading={barLoading}
        onChangeGroup={onChangeGroup}
        onOpenPlan={tripId !== null && trip ? () => router.push(tripPath(tripId)) : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // "clip" in a browser: the list panel is slid below the bottom edge, and a "hidden" box would let
  // the browser scroll the whole screen up to it when something down there takes the focus.
  screen: {
    flex: 1,
    backgroundColor: colors.page,
    overflow: "hidden",
    ...Platform.select({ web: { overflow: "clip" } as object, default: {} }),
  },
  fill: { flex: 1 },

  failed: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: GUTTER },
  failedBack: { alignSelf: "flex-start" },
  failedBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingBottom: spacing.xxl },

  float: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: GUTTER,
    paddingBottom: spacing.md,
  },
  credit: {
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: palette.glass,
  },
  creditText: { fontSize: 9, lineHeight: 12, color: colors.muted },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  roundPressed: { backgroundColor: palette.field },

  sheetHeader: { justifyContent: "center", height: SHEET_HEADER - 28 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: fontWeight.bold, letterSpacing: -0.3, color: colors.fg },
  detail: { marginTop: 2, fontSize: 13, lineHeight: 17, color: colors.muted },
  sheetPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  empty: { paddingVertical: spacing.lg },

  cardDock: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 2 },
  cardWrap: { paddingHorizontal: CARD_MARGIN, paddingBottom: CARD_MARGIN, gap: spacing.sm },
  strip: {
    minHeight: STRIP,
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg - 2,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.bg,
    shadowColor: colors.black,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  stripTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  stripTitle: { flexShrink: 1, fontSize: 13, lineHeight: 17, fontWeight: fontWeight.semibold, color: colors.fg },
  stripChips: { flexWrap: "wrap" },
});
