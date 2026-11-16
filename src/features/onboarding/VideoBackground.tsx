import { useIsFocused } from "expo-router";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Animated, Platform, StyleSheet } from "react-native";

/** Bryan's welcome footage: stock clips from Pexels (assets/welcome/SOURCES.md), 1080×1920 loops, in his order. */
const CLIPS: VideoSource[] = [
  require("../../../assets/welcome/01-fair.mp4"),
  require("../../../assets/welcome/02-club.mp4"),
  require("../../../assets/welcome/03-kites.mp4"),
  require("../../../assets/welcome/04-park.mp4"),
];

const SLIDE_MS = 3000;
const FADE_MS = 900;

/**
 * One clock for every `VideoBackground` on screen, so a second one mounted anywhere shows the same
 * clip as the first instead of starting over. Today only Welcome mounts one.
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

/**
 * The welcome footage, full bleed, cross-fading from clip to clip. It is a photo surface: put a
 * dark scrim over it and keep the text on it white, whatever the theme of the rest of the app.
 */
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
