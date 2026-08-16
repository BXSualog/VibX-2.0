import { Artwork } from "@/src/components/Artwork";
import { PlayingIndicator } from "@/src/components/PlayingIndicator";
import { useRowHighlight } from "@/src/hooks/useHover";
import { colors } from "@/src/theme/colors";
import type { Song } from "@/src/types/music";
import { formatTime } from "@/src/utils/format";
import { normalizeTrackLabels } from "@/src/utils/metadata";
import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export const SONG_ROW_HEIGHT = 84;

type Props = {
  song: Song;
  onPress: (song: Song) => void;
  onLongPress?: (song: Song) => void;
  subtitle?: string;
  active?: boolean;
  playing?: boolean;
  rank?: number;
};

export const SongCard = memo(function SongCard({
  song,
  onPress,
  onLongPress,
  subtitle,
  active = false,
  playing = false,
  rank,
}: Props) {
  const handlePress = useCallback(() => onPress(song), [onPress, song]);
  const handleLongPress = useCallback(
    () => onLongPress?.(song),
    [onLongPress, song],
  );
  const showPlaying = active && playing;
  const labels = normalizeTrackLabels(song.title, song.artist);
  const { highlight, pressProps } = useRowHighlight();

  return (
    <Pressable
      {...pressProps}
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={[styles.press, highlight]}
    >
      <View style={styles.row}>
        {typeof rank === 'number' ? (
          <Text style={styles.rank}>{rank}</Text>
        ) : null}
        <Artwork
          uri={song.artwork}
          title={labels.title}
          artist={labels.artist}
          size={52}
          rounded={10}
        />
        <View style={styles.meta}>
          <Text
            style={[styles.title, active && styles.titleActive]}
            numberOfLines={1}
          >
            {labels.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle ?? `${labels.artist} • ${song.album}`}
          </Text>
          {showPlaying ? <PlayingIndicator /> : null}
        </View>
        <Text style={styles.duration}>{formatTime(song.duration)}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  press: {
    height: SONG_ROW_HEIGHT,
    marginHorizontal: 12,
    borderRadius: 12,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  rank: {
    width: 22,
    marginRight: 6,
    fontSize: 15,
    fontWeight: "700",
    color: colors.accent,
    textAlign: "center",
  },
  meta: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  titleActive: {
    color: colors.accent,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 14,
    color: colors.muted,
  },
  duration: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.muted,
  },
});
