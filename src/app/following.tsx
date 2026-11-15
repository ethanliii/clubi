import { useQuery } from "convex/react";
import { useState } from "react";
import { View } from "react-native";
import { EmptyState, Header, Screen, SectionHeader, SkeletonRows, TextField } from "../components";
import { PerformerRow } from "../features/performers/PerformerRow";
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
      <Header title="Following" />
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
            <SectionHeader title="Results" />
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
          title="Rank a show you loved, or follow an artist, and we'll tell you when they're in town."
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
