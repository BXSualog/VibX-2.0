import { Artwork } from "@/src/components/Artwork";
import { PlayingIndicator } from "@/src/components/PlayingIndicator";
import { useRowHighlight } from "@/src/hooks/useHover";
import { usePlayerStore } from "@/src/stores/playerStore";
import { colors } from "@/src/theme/colors";
import type { Song } from "@/src/types/music";
import { formatTime } from "@/src/utils/format";
import { normalizeTrackLabels } from "@/src/utils/metadata";
import { memo, useCallback, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated from "react-native-reanimated";

const ARTWORK_SIZE = 52;
const ROW_PADDING_Y = 10;
const ROW_PADDING_X = 20;
const ROW_GAP = 8;
const DURATION_WIDTH = 44;
const TITLE_GAP = 14;
const RANK_WIDTH = 30;
const TRAILING_GAP = 10;

export const SONG_ROW_HEIGHT = ARTWORK_SIZE + ROW_PADDING_Y * 2 + ROW_GAP;

function metaWidth(screenWidth: number, rank?: number) {
  const contentWidth = screenWidth - ROW_PADDING_X * 2;
  const rankSpace = typeof rank === "number" ? RANK_WIDTH : 0;
  return Math.max(
    96,
    contentWidth -
      rankSpace -
      ARTWORK_SIZE -
      TITLE_GAP -
      DURATION_WIDTH -
      TRAILING_GAP,
  );
}

type Props = {
  song: Song;
  onPress: (song: Song) => void;
  onLongPress?: (song: Song) => void;
  subtitle?: string;
  active?: boolean;
  playing?: boolean;
  rank?: number;
  progress?: number | null;
  downloaded?: boolean;
};

export const SongCard = memo(function SongCard({
  song,
  onPress,
  onLongPress,
  subtitle,
  active = false,
  playing = false,
  rank,
  progress = null,
  downloaded,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const handlePress = useCallback(() => onPress(song), [onPress, song]);
  const handleLongPress = useCallback(
    () => onLongPress?.(song),
    [onLongPress, song],
  );
  const currentSongId = usePlayerStore(
    (state) => state.currentSong?.id ?? null,
  );
  const storePlaying = usePlayerStore((state) => state.isPlaying);
  const isActive = currentSongId ? currentSongId === song.id : active;
  const showPlaying = isActive && (currentSongId ? storePlaying : playing);
  const labels = normalizeTrackLabels(song?.title, song?.artist);
  const { highlightStyle, pressProps } = useRowHighlight();
  const inLibrary = downloaded ?? song.isDownloaded === 1;
  const preview = !inLibrary && Boolean(song.previewUrl);
  const detail =
    subtitle ??
    `${labels.artist}${
      inLibrary
        ? " • On this device"
        : preview
          ? " • Preview"
          : song.album
            ? ` • ${song.album}`
            : ""
    }`;
  const duration = preview ? song.previewDuration || 30 : song.duration;
  const textWidth = useMemo(
    () => metaWidth(screenWidth, rank),
    [rank, screenWidth],
  );

  if (!song?.id) return null;

  return (
    <View style={[styles.slot, { width: screenWidth }]}>
      <Pressable
        {...pressProps}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={280}
        android_ripple={{ color: "rgba(255,255,255,0.12)" }}
        accessibilityRole="button"
        style={styles.hit}
      >
        <Animated.View style={[styles.card, highlightStyle]}>
          <View style={styles.row}>
            {typeof rank === "number" ? (
              <Text style={styles.rank}>{rank}</Text>
            ) : null}
            <View style={styles.artworkSlot}>
              <Artwork
                uri={song.artwork}
                title={labels.title}
                artist={labels.artist}
                size={ARTWORK_SIZE}
                rounded={10}
              />
              {typeof progress === "number" &&
              progress > 0 &&
              progress < 1 ? (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progress * 100)}%` },
                    ]}
                  />
                </View>
              ) : null}
            </View>
            <View style={[styles.meta, { width: textWidth }]}>
              <Text
                style={[styles.title, isActive && styles.titleActive]}
                numberOfLines={1}
              >
                {labels.title}
              </Text>
              {showPlaying ? (
                <PlayingIndicator />
              ) : (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {detail}
                </Text>
              )}
            </View>
            <Text style={styles.duration}>{formatTime(duration)}</Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  slot: {
    height: SONG_ROW_HEIGHT,
    paddingBottom: ROW_GAP,
  },
  hit: {
    width: "100%",
  },
  card: {
    paddingVertical: ROW_PADDING_Y,
    paddingHorizontal: ROW_PADDING_X,
    justifyContent: "center",
  },
  row: {
    height: ARTWORK_SIZE,
    flexDirection: "row",
    alignItems: "center",
  },
  rank: {
    width: 22,
    marginRight: 8,
    flexShrink: 0,
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
    textAlign: "center",
  },
  artworkSlot: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    marginRight: TITLE_GAP,
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: 10,
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.accent,
  },
  meta: {
    marginRight: TRAILING_GAP,
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    letterSpacing: -0.15,
    color: colors.text,
    includeFontPadding: false,
  },
  titleActive: {
    color: colors.accent,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    includeFontPadding: false,
  },
  duration: {
    width: DURATION_WIDTH,
    flexShrink: 0,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
    textAlign: "right",
    includeFontPadding: false,
  },
});
