import { useIsFocused } from "expo-router";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Animated, Platform, StyleSheet } from "react-native";

/** The team's own footage. Originals live in the project drive at design/welcome-clips/. */
const CLIPS: VideoSource[] = [
  require("../../../assets/welcome/01-road.mp4"),
  require("../../../assets/welcome/02-fair.mp4"),
  require("../../../assets/welcome/03-party.mp4"),
  require("../../../assets/welcome/04-coast.mp4"),
  require("../../../assets/welcome/05-lake.mp4"),
];

const SLIDE_MS = 4200;
const FADE_MS = 1100;

/**
 * One clock for every `VideoBackground` on screen. Welcome and the sign-in sheet each mount their
 * own, and sharing the clip number is what makes the footage carry on from one into the other
 * instead of starting over.
 */
let activeClip = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    timer = setInterval(() => {
      activeClip = (activeClip + 1) % CLIPS.length;
      listeners.forEach((notify) => notify());
    }, SLIDE_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const readActiveClip = () => activeClip;

/** The welcome footage, full bleed, cross-fading from clip to clip. Put a scrim over it for text. */
export function VideoBackground() {
  const active = useSyncExternalStore(subscribe, readActiveClip, readActiveClip);
  // Under the sign-in sheet the welcome screen is still mounted: stop decoding video nobody can see.
  const focused = useIsFocused();

  return (
    <>
      {CLIPS.map((source, index) => (
        <Clip key={index} source={source} visible={index === active} playing={focused && index === active} />
      ))}
    </>
  );
}

function Clip({ source, visible, playing }: { source: VideoSource; visible: boolean; playing: boolean }) {
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });

  // Only the clip on screen decodes. One that has just been replaced keeps moving until it has
  // faded out, so the cross-fade never shows a frozen frame. (On web this effect is also what
  // starts the first clip: a `play()` in the setup above runs before the <video> element exists.)
  useEffect(() => {
    if (playing) {
      player.play();
      return;
    }
    const stop = setTimeout(() => player.pause(), FADE_MS);
    return () => clearTimeout(stop);
  }, [playing, player]);

  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: FADE_MS, useNativeDriver: Platform.OS !== "web" }).start();
  }, [visible, opacity]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <VideoView
        player={player}
        style={videoStyle}
        contentFit="cover"
        nativeControls={false}
        playsInline
        surfaceType="textureView"
      />
    </Animated.View>
  );
}

// Plain object on purpose: react-native-web compiles StyleSheet.create styles to class names,
// which the raw <video> element expo-video renders on web cannot read.
const videoStyle = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" } as const;
