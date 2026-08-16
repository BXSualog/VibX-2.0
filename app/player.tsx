import { PlayingIndicator } from "@/src/components/PlayingIndicator";
import { useLibraryStore } from "@/src/stores/libraryStore";
import { usePlayerStore } from "@/src/stores/playerStore";
import { colors } from "@/src/theme/colors";
import { brightCoverPalette } from "@/src/utils/cover";
import { formatTime } from "@/src/utils/format";
import { normalizeTrackLabels } from "@/src/utils/metadata";
import Slider from "@react-native-community/slider";
import TrackPlayer, {
  useActiveMediaItem,
  useProgress,
} from "@rntp/player";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const QUEUE_ITEM_HEIGHT = 72;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 850;

function PlayerHeroArt({
  uri,
  title,
  artist,
  size,
}: {
  uri?: string | null;
  title: string;
  artist?: string;
  size: number;
}) {
  const palette = brightCoverPalette(title, artist);
  const radius = Math.round(size * 0.1);
  const style = {
    width: size,
    height: size,
    borderRadius: radius,
  };

  return (
    <View
      style={{
        shadowColor: palette[1],
        shadowOpacity: 0.75,
        shadowRadius: 42,
        shadowOffset: { width: 0, height: 16 },
        elevation: 24,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: -10,
          top: -10,
          width: size + 20,
          height: size + 20,
          borderRadius: radius + 10,
          backgroundColor: palette[0],
          opacity: 0.35,
        }}
      />
      {uri ? (
        <Image
          source={{ uri }}
          style={style}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <LinearGradient
          colors={[palette[0], palette[1], palette[2]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            style,
            {
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            },
          ]}
        >
          <LinearGradient
            colors={[
              "rgba(255,255,255,0.55)",
              "rgba(255,255,255,0.08)",
              "transparent",
            ]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.7, y: 0.55 }}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />
          <SymbolView
            name={{
              ios: "music.note",
              android: "music_note",
              web: "music_note",
            }}
            tintColor="#FFFFFF"
            size={Math.round(size * 0.6)}
          />
        </LinearGradient>
      )}
    </View>
  );
}

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const item = useActiveMediaItem();
  const progress = useProgress(0.25);
  const songs = useLibraryStore((state) => state.songs);
  const isFavorite = useLibraryStore((state) => state.isFavorite);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const repeat = usePlayerStore((state) => state.repeat);
  const playing = usePlayerStore((state) => state.isPlaying);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);
  const skipNext = usePlayerStore((state) => state.skipNext);
  const skipPrevious = usePlayerStore((state) => state.skipPrevious);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const seek = usePlayerStore((state) => state.seek);
  const [queueOpen, setQueueOpen] = useState(false);
  const queueListRef = useRef<FlatList>(null);
  const dragY = useSharedValue(0);

  const goBack = useCallback(() => {
    router.back();
  }, []);

  const dismissPlayer = useCallback(() => {
    dragY.value = withTiming(height, { duration: 220 }, (finished) => {
      if (finished) runOnJS(goBack)();
    });
  }, [dragY, goBack, height]);

  const handlePan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-36, 36])
    .onUpdate((event) => {
      dragY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      const shouldClose =
        event.translationY > DISMISS_DISTANCE ||
        event.velocityY > DISMISS_VELOCITY;
      if (shouldClose) {
        dragY.value = withTiming(height, { duration: 220 }, (finished) => {
          if (finished) runOnJS(goBack)();
        });
        return;
      }
      dragY.value = withSpring(0, { damping: 22, stiffness: 240 });
    });

  const handleTap = Gesture.Tap().onEnd(() => {
    runOnJS(dismissPlayer)();
  });

  const handleGesture = Gesture.Simultaneous(handlePan, handleTap);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const song = songs.find((entry) => entry.id === item?.mediaId);
  const queue = TrackPlayer.getQueue?.() ?? [];
  const activeIndex = TrackPlayer.getActiveMediaItemIndex?.() ?? 0;
  const labels = normalizeTrackLabels(
    song?.title ?? item?.title ?? "Select a song",
    song?.artist ?? item?.artist ?? "VibX 2.0 offline player",
  );
  const title = labels.title;
  const artist = item ? labels.artist : "VibX 2.0 offline player";
  const artwork =
    song?.artwork ??
    (typeof item?.artworkUrl === "string" ? item.artworkUrl : null);
  const liked = song ? isFavorite(song.id) : false;
  const duration =
    progress.duration > 0 ? progress.duration : song?.duration || 0;

  const artSize = Math.round(
    Math.min(
      width - (queueOpen ? 96 : 48),
      height * (queueOpen ? 0.22 : 0.42),
      queueOpen ? 180 : 360,
    ),
  );

  const repeatIcon = useMemo(() => {
    if (repeat === "one")
      return {
        ios: "repeat.1",
        android: "repeat_one",
        web: "repeat_one",
      } as const;
    return { ios: "repeat", android: "repeat", web: "repeat" } as const;
  }, [repeat]);

  useEffect(() => {
    if (!queueOpen || queue.length === 0) return;
    const index = Math.min(Math.max(activeIndex, 0), queue.length - 1);
    const frame = requestAnimationFrame(() => {
      queueListRef.current?.scrollToOffset({
        offset: index * QUEUE_ITEM_HEIGHT,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [queueOpen]);

  const currentQueueIndex =
    queue.length === 0
      ? 0
      : Math.min(Math.max(activeIndex, 0), queue.length - 1);

  const renderQueueItem = useCallback(
    ({
      item: queued,
      index,
    }: {
      item: (typeof queue)[number];
      index: number;
    }) => (
      <Pressable
        onPress={() => TrackPlayer.skipToIndex(index)}
        className="flex-row items-center justify-center rounded-xl active:bg-white/5"
        style={{ height: QUEUE_ITEM_HEIGHT }}
      >
        <View className="min-w-0 flex-1">
          <Text
            className={
              index === activeIndex
                ? "font-bold text-vibx-accent"
                : "text-vibx-text"
            }
            numberOfLines={1}
          >
            {index === currentQueueIndex
              ? "Now · "
              : index === currentQueueIndex + 1
                ? "Next · "
                : ""}
            {normalizeTrackLabels(queued.title ?? "", queued.artist).title}
          </Text>
          <Text className="text-xs text-vibx-muted">
            {normalizeTrackLabels(queued.title ?? "", queued.artist).artist}
          </Text>
          {index === activeIndex && playing ? <PlayingIndicator /> : null}
        </View>
        <Text className="ml-3 text-xs text-vibx-muted">
          {formatTime(
            queued.duration ||
              songs.find((entry) => entry.id === queued.mediaId)?.duration ||
              0,
          )}
        </Text>
      </Pressable>
    ),
    [activeIndex, currentQueueIndex, playing, songs],
  );

  const playerChrome = (
    <>
      <View
        className={`${queueOpen ? "mb-5" : "min-h-[240px] flex-1"} items-center justify-center`}
      >
        <PlayerHeroArt
          uri={artwork}
          title={title}
          artist={artist}
          size={artSize}
        />
      </View>

      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <Text
            className="text-[26px] font-bold leading-8 tracking-tight text-vibx-text"
            numberOfLines={2}
          >
            {title}
          </Text>
          <Text
            className="mt-1.5 text-[16px] text-vibx-muted"
            numberOfLines={1}
          >
            {artist}
          </Text>
        </View>
        {song ? (
          <Pressable
            onPress={() => void toggleFavorite(song.id)}
            hitSlop={4}
            className="h-12 w-12 items-center justify-center rounded-full bg-white/10"
          >
            <SymbolView
              name={{
                ios: liked ? "heart.fill" : "heart",
                android: liked ? "favorite" : "favorite_border",
                web: "favorite",
              }}
              tintColor={liked ? "#38BDF8" : colors.text}
              size={24}
            />
          </Pressable>
        ) : null}
      </View>

      <View className="mt-7">
        <Slider
          value={progress.position}
          minimumValue={0}
          maximumValue={Math.max(duration, 1)}
          onSlidingComplete={seek}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor="rgba(255,255,255,0.16)"
          thumbTintColor={colors.text}
        />
        <View className="-mt-1 flex-row justify-between px-0.5">
          <Text className="text-xs text-vibx-muted">
            {formatTime(progress.position)}
          </Text>
          <Text className="text-xs text-vibx-muted">
            {formatTime(duration)}
          </Text>
        </View>
      </View>

      <View className="mt-6 flex-row items-center justify-between overflow-visible px-1">
        <Pressable
          onPress={toggleShuffle}
          className="h-14 w-14 items-center justify-center"
        >
          <SymbolView
            name={{ ios: "shuffle", android: "shuffle", web: "shuffle" }}
            tintColor={shuffle ? colors.accent : colors.text}
            size={28}
          />
        </Pressable>
        <Pressable
          onPress={skipPrevious}
          className="h-14 w-14 items-center justify-center"
        >
          <SymbolView
            name={{
              ios: "backward.fill",
              android: "skip_previous",
              web: "skip_previous",
            }}
            tintColor={colors.text}
            size={40}
          />
        </Pressable>
        <View
          className="items-center justify-center"
          style={{ width: 92, height: 92, overflow: "visible" }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 92,
              height: 92,
              borderRadius: 46,
              backgroundColor: "rgba(255,255,255,0.14)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 86,
              height: 86,
              borderRadius: 43,
              backgroundColor: "rgba(255,255,255,0.2)",
            }}
          />
          <Pressable
            onPress={togglePlay}
            className="h-20 w-20 items-center justify-center rounded-full bg-white"
          >
            <View style={{ opacity: playing ? 1 : 0, position: playing ? "relative" : "absolute" }}>
              <SymbolView
                name={{ ios: "pause.fill", android: "pause", web: "pause" }}
                tintColor={colors.background}
                size={40}
              />
            </View>
            <View style={{ opacity: playing ? 0 : 1, position: playing ? "absolute" : "relative" }}>
              <SymbolView
                name={{ ios: "play.fill", android: "play_arrow", web: "play_arrow" }}
                tintColor={colors.background}
                size={40}
              />
            </View>
          </Pressable>
        </View>
        <Pressable
          onPress={skipNext}
          className="h-14 w-14 items-center justify-center"
        >
          <SymbolView
            name={{
              ios: "forward.fill",
              android: "skip_next",
              web: "skip_next",
            }}
            tintColor={colors.text}
            size={40}
          />
        </Pressable>
        <Pressable
          onPress={cycleRepeat}
          className="h-14 w-14 items-center justify-center"
        >
          <SymbolView
            name={repeatIcon}
            tintColor={repeat === "off" ? colors.text : colors.accent}
            size={28}
          />
        </Pressable>
      </View>
    </>
  );

  return (
    <View className="flex-1">
      <Animated.View style={[{ flex: 1 }, sheetStyle]}>
        <LinearGradient
          colors={["#122046", "#1E3A8A", "#0B1220"]}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />

        <View
          className="flex-1 px-6"
          style={{
            paddingTop: insets.top + 4,
            paddingBottom: insets.bottom + (queueOpen ? 28 : 70),
          }}
        >
          <View className="h-12 items-center justify-center">
            <GestureDetector gesture={handleGesture}>
              <Animated.View
                accessibilityRole="button"
                accessibilityLabel="Close player"
                className="absolute inset-0 items-center justify-center"
              >
                <View className="h-1.5 w-12 rounded-full bg-white/35" />
              </Animated.View>
            </GestureDetector>
            <Pressable
              accessibilityLabel={queueOpen ? "Hide queue" : "Show queue"}
              onPress={() => setQueueOpen((open) => !open)}
              hitSlop={8}
              className="absolute right-0 z-10 h-11 w-11 items-center justify-center rounded-full bg-white/10"
            >
              <SymbolView
                name={{
                  ios: "list.bullet",
                  android: "queue_music",
                  web: "queue_music",
                }}
                tintColor={queueOpen ? colors.accent : colors.text}
                size={22}
              />
            </Pressable>
          </View>

          {queueOpen ? (
            <>
              {playerChrome}
              <Text className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-vibx-muted">
                Up next
              </Text>
              <FlatList
                ref={queueListRef}
                data={queue}
                keyExtractor={(queued, index) => `${queued.mediaId}-${index}`}
                renderItem={renderQueueItem}
                getItemLayout={(_, index) => ({
                  length: QUEUE_ITEM_HEIGHT,
                  offset: QUEUE_ITEM_HEIGHT * index,
                  index,
                })}
                extraData={`${activeIndex}:${playing}`}
                initialScrollIndex={
                  queue.length > 0 ? currentQueueIndex : undefined
                }
                onScrollToIndexFailed={(info) => {
                  queueListRef.current?.scrollToOffset({
                    offset: info.index * QUEUE_ITEM_HEIGHT,
                    animated: false,
                  });
                }}
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
              />
            </>
          ) : (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {playerChrome}
            </ScrollView>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
