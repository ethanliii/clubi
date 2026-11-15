import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { useEffect, useState } from "react";
import { Animated, Platform, StyleSheet } from "react-native";

/**
 * Placeholder footage generated for this repo (abstract gradients, no people).
 * Swap in licensed or original clips before any public demo.
 */
const CLIPS: VideoSource[] = [
  require("../../../assets/welcome/clip-1.mp4"),
  require("../../../assets/welcome/clip-2.mp4"),
  require("../../../assets/welcome/clip-3.mp4"),
  require("../../../assets/welcome/clip-4.mp4"),
];

const SLIDE_MS = 3000;
const FADE_MS = 900;

export function VideoBackground() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActive((current) => (current + 1) % CLIPS.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {CLIPS.map((source, index) => (
        <Clip key={index} source={source} visible={index === active} />
      ))}
    </>
  );
}

function Clip({ source, visible }: { source: VideoSource; visible: boolean }) {
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

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
        surfaceType="textureView"
      />
    </Animated.View>
  );
}

// Plain object on purpose: react-native-web compiles StyleSheet.create styles to class names,
// which the raw <video> element expo-video renders on web cannot read.
const videoStyle = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" } as const;
