import { useQuery } from "convex/react";
import { useState } from "react";
import { View } from "react-native";
import { EmptyState, Screen, SkeletonRows, TextField } from "../components";
import { PerformerRow } from "../features/performers/PerformerRow";
import { ScreenTop } from "../features/trips/ScreenTop";
import { api } from "../lib/api";
import { useDebounced } from "../lib/useDebounced";
import { useNow } from "../lib/useNow";

export default function FollowingScreen() {
  const now = useNow();
  const [input, setInput] = useState("");
  const text = useDebounced(input, 300).trim();
  const searching = text.length >= 2;

  const following = useQuery(api.performers.following, {});
  const results = useQuery(api.performers.search, searching ? { text } : "skip");

  return (
    <Screen>
      <ScreenTop title="Following" />
      <TextField
        placeholder="Search artists"
        value={input}
        onChangeText={setInput}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      {searching ? (
        results === undefined ? (
          <SkeletonRows count={4} />
        ) : results.length === 0 ? (
          <EmptyState title={`No artists found for "${text}".`} body="Try another spelling, or part of the name." icon="search" />
        ) : (
          <View>
            {results.map((performer) => (
              <PerformerRow key={performer.performerId} performer={performer} now={now} />
            ))}
          </View>
        )
      ) : following === undefined ? (
        <SkeletonRows count={5} />
      ) : following.length === 0 ? (
        <EmptyState
          icon="music"
          title="Follow an artist and we'll tell you when they're in town."
          body="Search by name above, or rank a show you loved."
        />
      ) : (
        <View>
          {following.map((performer) => (
            <PerformerRow key={performer.performerId} performer={performer} now={now} />
          ))}
        </View>
      )}
    </Screen>
  );
}
