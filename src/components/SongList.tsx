import { memo, useCallback, useMemo, useState, type ComponentType, type ReactElement } from 'react';
import { FlatList, View, type LayoutChangeEvent, type ListRenderItem, type StyleProp, type ViewStyle } from 'react-native';
import { useActiveMediaItem, useIsPlaying } from '@rntp/player';
import { AzLetterHeader, AZ_LETTER_HEADER_HEIGHT } from '@/src/components/AzLetterHeader';
import { SongCard, SONG_ROW_HEIGHT } from '@/src/components/SongCard/SongCard';
import { usePlayerStore } from '@/src/stores/playerStore';
import { flattenAzItems, layoutsForRows } from '@/src/utils/sort';
import { normalizeTrackLabels } from '@/src/utils/metadata';
import type { Song } from '@/src/types/music';

export { SONG_ROW_HEIGHT };

export const LIST_SCROLL_PROPS = {
  initialNumToRender: 10,
  maxToRenderPerBatch: 8,
  updateCellsBatchingPeriod: 50,
  windowSize: 5,
  removeClippedSubviews: false,
} as const;

const LIST_STYLE: ViewStyle = { flex: 1, width: '100%' };
const LIST_CONTENT_STYLE: ViewStyle = {
  paddingBottom: 24,
  width: '100%',
};

type Row = ReturnType<typeof flattenAzItems<Song>>[number];

type Props = {
  songs: Song[];
  onPlay: (song: Song, queue: Song[]) => void;
  onLongPress?: (song: Song) => void;
  subtitleFor?: (song: Song) => string;
  groupByLetter?: boolean;
  ListEmptyComponent?: ComponentType | ReactElement | null;
  ListHeaderComponent?: ComponentType | ReactElement | null;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
};

export const SongList = memo(function SongList({
  songs,
  onPlay,
  onLongPress,
  subtitleFor,
  groupByLetter = false,
  ListEmptyComponent,
  ListHeaderComponent,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
}: Props) {
  const nativeId = useActiveMediaItem()?.mediaId ?? null;
  const nativePlaying = useIsPlaying();
  const currentSongId = usePlayerStore((state) => state.currentSong?.id ?? null);
  const storePlaying = usePlayerStore((state) => state.isPlaying);
  const activeId = currentSongId ?? nativeId;
  const playing = currentSongId ? storePlaying : nativePlaying;
  const [headerHeight, setHeaderHeight] = useState(92);

  const rows = useMemo(
    () => flattenAzItems(songs, (song) => normalizeTrackLabels(song.title, song.artist).title, (song) => song.id, groupByLetter),
    [groupByLetter, songs]
  );

  const layouts = useMemo(
    () => layoutsForRows(rows, SONG_ROW_HEIGHT, AZ_LETTER_HEADER_HEIGHT),
    [rows]
  );

  const onPress = useCallback(
    (song: Song) => {
      onPlay(song, songs);
    },
    [onPlay, songs]
  );

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setHeaderHeight((current) => (current === height ? current : height));
  }, []);

  const renderItem: ListRenderItem<Row> = useCallback(
    ({ item }) => {
      if (item.type === 'letter') return <AzLetterHeader letter={item.letter} />;
      return (
        <SongCard
          song={item.item}
          active={item.item.id === activeId}
          playing={item.item.id === activeId && playing}
          onPress={onPress}
          onLongPress={onLongPress}
          subtitle={subtitleFor?.(item.item)}
        />
      );
    },
    [activeId, onLongPress, onPress, playing, subtitleFor]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => {
      const layout = layouts[index];
      if (!layout) {
        return { length: SONG_ROW_HEIGHT, offset: headerHeight + index * SONG_ROW_HEIGHT, index };
      }
      return { length: layout.length, offset: headerHeight + layout.offset, index };
    },
    [headerHeight, layouts]
  );

  const header = useMemo(() => {
    if (!ListHeaderComponent) return null;
    return (
      <View onLayout={onHeaderLayout}>
        {isHeaderElement(ListHeaderComponent) ? ListHeaderComponent : <ListHeaderComponent />}
      </View>
    );
  }, [ListHeaderComponent, onHeaderLayout]);

  return (
    <FlatList
      style={LIST_STYLE}
      data={rows}
      keyExtractor={rowKeyExtractor}
      renderItem={renderItem}
      extraData={`${activeId}:${playing}:${currentSongId}:${storePlaying}`}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={header}
      contentContainerStyle={[LIST_CONTENT_STYLE, contentContainerStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      getItemLayout={getItemLayout}
      {...LIST_SCROLL_PROPS}
    />
  );
});

function rowKeyExtractor(row: Row) {
  return row.key;
}

function isHeaderElement(
  value: ComponentType | ReactElement
): value is ReactElement {
  return typeof value === 'object' && value !== null && 'props' in value;
}
