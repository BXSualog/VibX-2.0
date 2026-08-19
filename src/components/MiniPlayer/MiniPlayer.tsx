import { Artwork } from "@/src/components/Artwork";
import { useCatalogStore } from "@/src/stores/catalogStore";
import { useLibraryStore } from "@/src/stores/libraryStore";
import { usePlayerStore } from "@/src/stores/playerStore";
import { colors } from "@/src/theme/colors";
import { isPreviewSong, previewCap } from "@/src/utils/catalog";
import { normalizeTrackLabels } from "@/src/utils/metadata";
import TrackPlayer, { useActiveMediaItem, useProgress } from "@rntp/player";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import { memo, useCallback } from "react";
import { Text, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  Pressable,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const SKIP_DISTANCE = 72;
const SKIP_VELOCITY = 800;
export const MINI_PLAYER_HEIGHT = 76;

function MiniProgressBar({ preview, cap }: { preview: boolean; cap: number }) {
  const progress = useProgress(1);
  const duration = preview ? cap : progress.duration;
  const ratio = duration > 0 ? Math.min(progress.position / duration, 1) : 0;

  return (
    <View style={{ height: 3, backgroundColor: "rgba(255,255,255,0.12)" }}>
      <View
        style={{
          height: 3,
          width: `${ratio * 100}%`,
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
}

export const MiniPlayer = memo(function MiniPlayer() {
  const item = useActiveMediaItem();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const playing = usePlayerStore((state) => state.isPlaying);
  const songs = useLibraryStore((state) => state.songs);
  const catalogSong = useCatalogStore((state) => {
    const id = item?.mediaId ?? currentSong?.id;
    return id ? state.byId[id] : undefined;
  });
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const skipNext = usePlayerStore((state) => state.skipNext);
  const skipPrevious = usePlayerStore((state) => state.skipPrevious);
  const pathname = usePathname();
  const dragX = useSharedValue(0);

  const openPlayer = useCallback(() => {
    router.push("/player");
  }, []);

  const commitSkip = useCallback(
    (direction: "next" | "prev") => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (direction === "next") skipNext();
      else skipPrevious();
      TrackPlayer.play();
      dragX.value = 0;
    },
    [dragX, skipNext, skipPrevious],
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      dragX.value = event.translationX * 0.35;
    })
    .onEnd((event) => {
      const shouldSkip =
        Math.abs(event.translationX) > SKIP_DISTANCE ||
        Math.abs(event.velocityX) > SKIP_VELOCITY;
      if (shouldSkip) {
        runOnJS(commitSkip)(event.translationX < 0 ? "next" : "prev");
        return;
      }
      dragX.value = withSpring(0, { damping: 22, stiffness: 240 });
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }));

  if (pathname === "/player") return null;
  if (!item && !currentSong) return null;

  const song =
    songs.find((entry) => entry.id === (item?.mediaId ?? currentSong?.id)) ??
    catalogSong ??
    currentSong;
  const labels = normalizeTrackLabels(
    song?.title ?? item?.title ?? "Unknown",
    song?.artist ?? item?.artist,
  );
  const extras = item?.extras as { preview?: string } | undefined;
  const preview = extras?.preview === "1" || isPreviewSong(song);
  const artwork =
    song?.artwork ??
    (typeof item?.artworkUrl === "string" ? item.artworkUrl : null);

  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.05)",
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.05)",
      }}
    >
      <MiniProgressBar preview={preview} cap={previewCap(song)} />
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              height: MINI_PLAYER_HEIGHT,
              flexDirection: "row",
              alignItems: "center",
              paddingLeft: 14,
              paddingRight: 10,
            },
            dragStyle,
          ]}
        >
          <Pressable
            onPress={openPlayer}
            style={{
              flex: 1,
              minWidth: 0,
              height: MINI_PLAYER_HEIGHT,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Artwork
              uri={artwork}
              title={labels.title}
              artist={labels.artist}
              size={44}
              rounded={10}
            />
            <View
              style={{ flex: 1, minWidth: 0, marginLeft: 14, marginRight: 10 }}
            >
              <Text
                numberOfLines={1}
                style={{ fontSize: 14, fontWeight: "700", color: colors.text }}
              >
                {labels.title}
              </Text>
              <Text
                numberOfLines={1}
                style={{ marginTop: 2, fontSize: 12, color: colors.muted }}
              >
                {preview ? `Preview · ${labels.artist}` : labels.artist}
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={skipPrevious}
            hitSlop={6}
            style={{
              width: 44,
              height: MINI_PLAYER_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SymbolView
              name={{
                ios: "backward.fill",
                android: "skip_previous",
                web: "skip_previous",
              }}
              tintColor={colors.text}
              size={22}
            />
          </Pressable>
          <Pressable
            onPress={togglePlay}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              marginHorizontal: 4,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SymbolView
              name={{
                ios: playing ? "pause.fill" : "play.fill",
                android: playing ? "pause" : "play_arrow",
                web: playing ? "pause" : "play_arrow",
              }}
              tintColor="#FFFFFF"
              size={22}
            />
          </Pressable>
          <Pressable
            onPress={skipNext}
            hitSlop={6}
            style={{
              width: 44,
              height: MINI_PLAYER_HEIGHT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SymbolView
              name={{
                ios: "forward.fill",
                android: "skip_next",
                web: "skip_next",
              }}
              tintColor={colors.text}
              size={22}
            />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});
