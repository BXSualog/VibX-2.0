import { PlayerLyrics } from "@/src/components/PlayerLyrics/PlayerLyrics";
import { PlayingIndicator } from "@/src/components/PlayingIndicator";
import { useTrackLyrics } from "@/src/hooks/useTrackLyrics";
import { useRowHighlight } from "@/src/hooks/useHover";
import { useLibraryStore } from "@/src/stores/libraryStore";
import { usePlayerStore } from "@/src/stores/playerStore";
import { useCatalogStore } from "@/src/stores/catalogStore";
import { useDownloadStore } from "@/src/stores/downloadStore";
import { colors } from "@/src/theme/colors";
import { brightCoverPalette } from "@/src/utils/cover";
import { formatTime } from "@/src/utils/format";
import { isPreviewSong, previewCap } from "@/src/utils/catalog";
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
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
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

const QueueSongRow = memo(function QueueSongRow({
  title,
  artist,
  duration,
  prefix,
  active,
  playing,
  onPress,
}: {
  title: string;
  artist: string;
  duration: number;
  prefix: string;
  active: boolean;
  playing: boolean;
  onPress: () => void;
}) {
  const { highlightStyle, pressProps } = useRowHighlight();

  return (
    <Pressable
      {...pressProps}
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.12)" }}
      accessibilityRole="button"
    >
      <Animated.View
        className="flex-row items-center justify-center rounded-xl"
        style={[
          { height: QUEUE_ITEM_HEIGHT, cursor: "pointer" as const },
          highlightStyle,
        ]}
      >
        <View className="min-w-0 flex-1">
          <Text
            className={active ? "font-bold text-vibx-accent" : "text-vibx-text"}
            numberOfLines={1}
          >
            {prefix}
            {title}
          </Text>
          <Text className="text-xs text-vibx-muted">{artist}</Text>
          {active && playing ? <PlayingIndicator /> : null}
        </View>
        <Text className="ml-3 text-xs text-vibx-muted">
          {formatTime(duration)}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

const PlayerSeekBar = memo(function PlayerSeekBar({
  duration,
  onSeek,
}: {
  duration: number;
  onSeek: (position: number) => void;
}) {
  const progress = useProgress(0.25);
  const total = Math.max(duration > 1 ? duration : progress.duration, 1);
  const position = Math.min(progress.position, total);

  return (
    <View className="mt-7">
      <Slider
        value={position}
        minimumValue={0}
        maximumValue={total}
        onSlidingComplete={onSeek}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor="rgba(255,255,255,0.16)"
        thumbTintColor={colors.text}
      />
      <View className="-mt-1 flex-row justify-between px-0.5">
        <Text className="text-xs text-vibx-muted">{formatTime(position)}</Text>
        <Text className="text-xs text-vibx-muted">{formatTime(total)}</Text>
      </View>
    </View>
  );
});

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const item = useActiveMediaItem();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const songs = useLibraryStore((state) => state.songs);
  const isFavorite = useLibraryStore((state) => state.isFavorite);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const downloadSong = useDownloadStore((state) => state.downloadSong);
  const downloadJobs = useDownloadStore((state) => state.jobs);
  const catalogSong = useCatalogStore((state) => {
    const id = item?.mediaId ?? currentSong?.id;
    return id ? state.byId[id] : undefined;
  });
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

  const song =
    songs.find((entry) => entry.id === (item?.mediaId ?? currentSong?.id)) ??
    catalogSong ??
    currentSong;
  const extras = item?.extras as { preview?: string } | undefined;
  const preview = extras?.preview === "1" || isPreviewSong(song);
  const cap = previewCap(song);
  const duration = preview ? cap : song?.duration || 0;
  const downloadJob = song ? downloadJobs[song.id] : undefined;
  const downloading =
    downloadJob?.status === "queued" || downloadJob?.status === "downloading";
  const saved = Boolean(song?.isDownloaded);
  const onSeek = useCallback(
    (position: number) => {
      seek(preview ? Math.min(position, cap) : position);
    },
    [cap, preview, seek],
  );
  const lyrics = useTrackLyrics(song, duration);
  const hasLyrics = Boolean(lyrics?.lines.length);
  const queue = TrackPlayer.getQueue?.() ?? [];
  const activeIndex = TrackPlayer.getActiveMediaItemIndex?.() ?? 0;
  const labels = normalizeTrackLabels(
    song?.title ?? item?.title ?? "Select a song",
    song?.artist ?? item?.artist ?? "VibX 2.0 offline player",
  );
  const title = labels.title;
  const artist = item || currentSong ? labels.artist : "VibX 2.0 offline player";
  const artwork =
    song?.artwork ??
    (typeof item?.artworkUrl === "string" ? item.artworkUrl : null);
  const liked = song ? isFavorite(song.id) : false;

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
    }) => {
      const labels = normalizeTrackLabels(queued.title ?? "", queued.artist);
      const prefix =
        index === currentQueueIndex
          ? "Now · "
          : index === currentQueueIndex + 1
            ? "Next · "
            : "";
      return (
        <QueueSongRow
          title={labels.title}
          artist={labels.artist}
          duration={
            queued.duration ||
            songs.find((entry) => entry.id === queued.mediaId)?.duration ||
            0
          }
          prefix={prefix}
          active={index === activeIndex}
          playing={playing}
          onPress={() => TrackPlayer.skipToIndex(index)}
        />
      );
    },
    [activeIndex, currentQueueIndex, playing, songs],
  );

  const playerChrome = (
    <>
      <View
        className={`${queueOpen ? "mb-5" : "min-h-[240px] flex-1"} items-center justify-center`}
      >
        {hasLyrics && lyrics ? (
          <PlayerLyrics
            lines={lyrics.lines}
            title={title}
            artist={artist}
            height={Math.round(
              Math.min(
                height * (queueOpen ? 0.2 : 0.4),
                queueOpen ? 168 : 340,
              ),
            )}
            onSeek={onSeek}
          />
        ) : (
          <PlayerHeroArt
            uri={artwork}
            title={title}
            artist={artist}
            size={artSize}
          />
        )}
      </View>

      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          {preview ? (
            <Text className="mb-1 text-[11px] font-bold uppercase tracking-[1.6px] text-vibx-accent">
              Preview
            </Text>
          ) : null}
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
        {song && preview ? (
          <Pressable
            onPress={() => {
              if (!song.downloadUrl) return;
              void downloadSong(song);
            }}
            disabled={!song.downloadUrl && !downloading}
            hitSlop={4}
            accessibilityLabel={
              song.downloadUrl ? "Download full track" : "Full track not available"
            }
            className={`h-12 items-center justify-center rounded-full bg-white/10 px-3.5 ${
              song.downloadUrl || downloading ? "" : "opacity-50"
            }`}
          >
            <Text className="text-xs font-bold text-vibx-text">
              {downloading
                ? `${Math.round((downloadJob?.progress ?? 0) * 100)}%`
                : song.downloadUrl
                  ? "Download"
                  : "Preview only"}
            </Text>
          </Pressable>
        ) : null}
        {song && saved ? (
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

      <PlayerSeekBar duration={duration} onSeek={onSeek} />

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
          ) : hasLyrics ? (
            <View className="flex-1">{playerChrome}</View>
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
