import { EmptyState } from "@/src/components/EmptyState";
import { MINI_PLAYER_HEIGHT } from "@/src/components/MiniPlayer/MiniPlayer";
import { MiniPlayerDock } from "@/src/components/MiniPlayer/MiniPlayerDock";
import { useLibraryStore } from "@/src/stores/libraryStore";
import { usePlayerStore } from "@/src/stores/playerStore";
import { useRowHighlight } from "@/src/hooks/useHover";
import { colors } from "@/src/theme/colors";
import { artistAlbumsFromSongs } from "@/src/utils/artistAlbums";
import { brightCoverPalette } from "@/src/utils/cover";
import { formatDurationLabel, formatTime } from "@/src/utils/format";
import { artistGroupKey } from "@/src/utils/knownArtists";
import { normalizeTrackLabels } from "@/src/utils/metadata";
import { shuffled } from "@/src/utils/sort";
import type { Song } from "@/src/types/music";
import { useActiveMediaItem, useIsPlaying } from "@rntp/player";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const PLAYING_BARS = [0.45, 1, 0.62];

export default function AlbumScreen() {
  const { artist: artistParam } = useLocalSearchParams<{ artist?: string }>();
  const { width } = useWindowDimensions();
  const songs = useLibraryStore((state) => state.songs);
  const playAll = usePlayerStore((state) => state.playAll);
  const activeId = useActiveMediaItem()?.mediaId ?? null;
  const playing = useIsPlaying();
  const insets = useSafeAreaInsets();
  const coverSize = Math.min(220, Math.round(width * 0.58));

  const album = useMemo(() => {
    const wanted = artistGroupKey(String(artistParam ?? ""));
    if (!wanted) return null;
    return (
      artistAlbumsFromSongs(songs).find(
        (item) => artistGroupKey(item.artist) === wanted,
      ) ?? null
    );
  }, [artistParam, songs]);

  const palette = brightCoverPalette(album?.artist ?? "album", "collection");

  const onPlay = useCallback(() => {
    if (!album) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playAll(album.songs, 0, false, 'all');
  }, [album, playAll]);

  const onShuffle = useCallback(() => {
    if (!album) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playAll(shuffled(album.songs), 0, true, 'all');
  }, [album, playAll]);

  const onPlayTrack = useCallback(
    (song: Song) => {
      if (!album) return;
      const index = Math.max(
        0,
        album.songs.findIndex((item) => item.id === song.id),
      );
      playAll(album.songs, index, false, "all");
    },
    [album, playAll],
  );

  if (!album) {
    return (
      <SafeAreaView className="flex-1 bg-vibx-bg" edges={["top"]}>
        <Pressable
          onPress={() => router.back()}
          className="ml-3 h-10 w-10 items-center justify-center"
        >
          <SymbolView
            name={{
              ios: "chevron.left",
              android: "arrow_back",
              web: "arrow_back",
            }}
            tintColor={colors.text}
            size={22}
          />
        </Pressable>
        <EmptyState
          title="Album not found"
          subtitle="This artist needs at least 3 songs on your device."
        />
        <MiniPlayerDock />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-vibx-bg" edges={["top"]}>
      <LinearGradient
        colors={[palette[1], colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: MINI_PLAYER_HEIGHT + Math.max(insets.bottom, 12) + 48,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="-ml-2 h-10 w-10 items-center justify-center"
        >
          <SymbolView
            name={{
              ios: "chevron.left",
              android: "arrow_back",
              web: "arrow_back",
            }}
            tintColor={colors.text}
            size={22}
          />
        </Pressable>

        <View className="items-center">
          <View
            className="overflow-hidden rounded-2xl"
            style={{
              width: coverSize,
              height: coverSize,
              shadowColor: palette[0],
              shadowOpacity: 0.55,
              shadowRadius: 22,
              shadowOffset: { width: 0, height: 12 },
              elevation: 14,
            }}
          >
            {album.artwork ? (
              <Image
                source={{ uri: album.artwork }}
                style={{ width: coverSize, height: coverSize }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <LinearGradient
                colors={[palette[0], palette[1], colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: coverSize,
                  height: coverSize,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 18,
                }}
              >
                <SymbolView
                  name={{ ios: "music.note", android: "album", web: "album" }}
                  tintColor="rgba(255,255,255,0.95)"
                  size={Math.round(coverSize * 0.34)}
                />
                <Text
                  numberOfLines={2}
                  className="mt-3 text-center text-[15px] font-bold text-white"
                >
                  {album.artist}
                </Text>
              </LinearGradient>
            )}
          </View>

          <Text className="mt-4 text-[11px] font-bold tracking-[1.6px] text-vibx-accent">
            ALBUM
          </Text>
          <Text className="mt-1.5 text-center text-[32px] font-extrabold tracking-[-0.8px] text-vibx-text">
            {album.artist}
          </Text>
          <Text className="mt-2 text-[13px] text-vibx-muted">
            {album.songs.length} {album.songs.length === 1 ? "song" : "songs"}
            {album.duration > 0
              ? `  ·  ${formatDurationLabel(album.duration)}`
              : ""}
          </Text>
        </View>

        <View className="mt-6 flex-row" style={{ gap: 12 }}>
          <Pressable
            onPress={onPlay}
            className="h-12 flex-1 flex-row items-center justify-center rounded-full active:opacity-85"
            style={{ backgroundColor: colors.primary }}
          >
            <View className="mr-2 h-5 w-5 items-center justify-center">
              <SymbolView
                name={{
                  ios: "play.fill",
                  android: "play_arrow",
                  web: "play_arrow",
                }}
                tintColor="#FFFFFF"
                size={18}
              />
            </View>
            <Text className="text-[16px] font-extrabold text-white">Play</Text>
          </Pressable>
          <Pressable
            onPress={onShuffle}
            className="h-12 flex-1 flex-row items-center justify-center rounded-full active:opacity-85"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            <View className="mr-2 h-5 w-5 items-center justify-center">
              <SymbolView
                name={{ ios: "shuffle", android: "shuffle", web: "shuffle" }}
                tintColor={colors.primary}
                size={16}
              />
            </View>
            <Text
              className="text-[16px] font-extrabold"
              style={{ color: colors.primary }}
            >
              Shuffle
            </Text>
          </Pressable>
        </View>

        <View
          className="mt-8 flex-row items-center border-b border-white/10 px-3 -mx-3"
          style={{ paddingBottom: 12, marginBottom: 6 }}
        >
          <Text style={[styles.colIndex, styles.heading]}>#</Text>
          <Text style={[styles.colTitle, styles.heading]}>Title</Text>
          <Text style={[styles.colTime, styles.heading]}>Time</Text>
        </View>

        {album.songs.map((song, index) => (
          <AlbumTrackRow
            key={song.id}
            song={song}
            index={index}
            active={song.id === activeId}
            playing={playing}
            onPress={onPlayTrack}
          />
        ))}
      </ScrollView>
      <MiniPlayerDock />
    </SafeAreaView>
  );
}

function AlbumTrackRow({
  song,
  index,
  active,
  playing,
  onPress,
}: {
  song: Song;
  index: number;
  active: boolean;
  playing: boolean;
  onPress: (song: Song) => void;
}) {
  const labels = normalizeTrackLabels(song.title, song.artist);
  const { highlightStyle, pressProps } = useRowHighlight();

  return (
    <View collapsable={false}>
      {index > 0 ? (
        <View collapsable={false} style={{ height: 15, width: "100%" }} />
      ) : null}
      <Pressable
        {...pressProps}
        onPress={() => onPress(song)}
        android_ripple={{ color: "rgba(255,255,255,0.12)" }}
        accessibilityRole="button"
      >
        <Animated.View style={[styles.trackPress, highlightStyle]}>
          <View style={styles.trackRow}>
            <View style={styles.indexSlot}>
              {active && playing ? (
                <PlayingBars />
              ) : (
                <Text style={[styles.index, active && styles.activeText]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.trackTitle,
                active && styles.activeText,
                { paddingVertical: 16, lineHeight: 28 },
              ]}
            >
              {labels.title}
            </Text>
            <Text style={[styles.duration, active && styles.activeText]}>
              {song.duration > 0 ? formatTime(song.duration) : "--:--"}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

function PlayingBars() {
  return (
    <View
      className="h-3.5 w-3.5 flex-row items-center justify-end"
      style={{ gap: 2 }}
    >
      {PLAYING_BARS.map((peak, index) => (
        <PlayingBar key={index} index={index} peak={peak} />
      ))}
    </View>
  );
}

function PlayingBar({ index, peak }: { index: number; peak: number }) {
  const scale = useSharedValue(0.28);

  useEffect(() => {
    scale.value = withDelay(
      index * 70,
      withRepeat(
        withSequence(
          withTiming(peak, { duration: 240 + (index % 3) * 40 }),
          withTiming(0.28, { duration: 240 + (index % 2) * 40 }),
        ),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(scale);
  }, [index, peak, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return (
    <Animated.View
      className="h-3.5 w-[2.5px] rounded-sm bg-vibx-accent"
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  trackPress: {
    marginHorizontal: -12,
    borderRadius: 12,
    cursor: "pointer",
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  heading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: colors.muted,
    textTransform: "uppercase",
  },
  colIndex: {
    width: 28,
    textAlign: "right",
  },
  colTitle: {
    flex: 1,
    marginLeft: 16,
    marginRight: 16,
  },
  colTime: {
    width: 56,
    textAlign: "right",
  },
  indexSlot: {
    width: 28,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  index: {
    width: 28,
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  trackTitle: {
    flex: 1,
    marginLeft: 16,
    marginRight: 16,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  duration: {
    width: 56,
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  activeText: {
    color: colors.accent,
  },
});
