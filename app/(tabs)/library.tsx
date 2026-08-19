import { AlbumCard } from "@/src/components/AlbumCard/AlbumCard";
import { Artwork } from "@/src/components/Artwork";
import {
    AZ_LETTER_HEADER_HEIGHT,
    AzLetterHeader,
} from "@/src/components/AzLetterHeader";
import { EmptyState } from "@/src/components/EmptyState";
import { PlaylistCard } from "@/src/components/PlaylistCard/PlaylistCard";
import { SongContextMenu } from "@/src/components/SongContextMenu";
import { LIST_SCROLL_PROPS, SongList } from "@/src/components/SongList";
import { isLockedPlaylist } from "@/src/constants/playlists";
import { getPlaylistSongs } from "@/src/services/database";
import { useLibraryStore } from "@/src/stores/libraryStore";
import { usePlayerStore } from "@/src/stores/playerStore";
import { useRowHighlight } from "@/src/hooks/useHover";
import { colors } from "@/src/theme/colors";
import type { Song } from "@/src/types/music";
import {
    artistGroupKey,
    buildArtistCanonicalMap,
    clusteredArtistName,
} from "@/src/utils/knownArtists";
import { normalizeTrackLabels } from "@/src/utils/metadata";
import { getLibraryCatalog } from "@/src/utils/libraryCatalog";
import {
    compareText,
    flattenAzItems,
    groupByAzLetter,
    layoutsForRows,
} from "@/src/utils/sort";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type LayoutChangeEvent,
} from "react-native";
import Animated from "react-native-reanimated";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";

const FILTERS = ["Songs", "Albums", "Artists", "Vibed", "Playlists"] as const;
const SORTS = [
  { id: "az", label: "A–Z" },
  { id: "recent", label: "Last added" },
] as const;

type SortMode = (typeof SORTS)[number]["id"];
type AlbumRow = {
  album: string;
  artist: string;
  count: number;
  artwork: string | null;
  createdAt: number;
};
type ArtistRow = {
  artist: string;
  count: number;
  artwork: string | null;
  createdAt: number;
};
type AlbumListRow =
  | { type: "letter"; key: string; letter: string }
  | { type: "pair"; key: string; left: AlbumRow; right?: AlbumRow };

const ARTIST_ARTWORK_SIZE = 56;
const ARTIST_ROW_PADDING_Y = 12;
const ARTIST_ROW_HEIGHT = ARTIST_ARTWORK_SIZE + ARTIST_ROW_PADDING_Y * 2;
const ALBUM_META_HEIGHT = 70;
const ALBUM_ROW_GAP = 16;

function VibedEmpty() {
  return (
    <EmptyState
      title="Nothing in Vibed yet"
      subtitle="Tap the heart on a track to add it to Vibed."
    />
  );
}

function LibraryEmpty() {
  return (
    <EmptyState
      title="Your library is empty"
      subtitle="Import local music from the Profile tab."
    />
  );
}

function AlbumsEmpty() {
  return (
    <EmptyState
      title="No albums yet"
      subtitle="Albums appear here after you add music."
    />
  );
}

function ArtistsEmpty() {
  return (
    <EmptyState
      title="No artists yet"
      subtitle="Artists appear here after you add music."
    />
  );
}

function chunkPairs<T>(items: T[]): { left: T; right?: T }[] {
  const rows: { left: T; right?: T }[] = [];
  for (let index = 0; index < items.length; index += 2) {
    rows.push({ left: items[index], right: items[index + 1] });
  }
  return rows;
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const albumSize = Math.floor((width - 54) / 2) - 8;
  const albumRowHeight = albumSize + ALBUM_META_HEIGHT + ALBUM_ROW_GAP;
  const songs = useLibraryStore((state) => state.songs);
  const favorites = useLibraryStore((state) => state.favorites);
  const playlists = useLibraryStore((state) => state.playlists);
  const playAll = usePlayerStore((state) => state.playAll);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Songs");
  const [sort, setSort] = useState<SortMode>("az");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Song | null>(null);
  const [playlistCounts, setPlaylistCounts] = useState<Record<string, number>>(
    {},
  );

  const catalog = useMemo(() => getLibraryCatalog(songs), [songs]);
  const labelsById = catalog.labelsById;

  const sortedSongs =
    sort === "recent" ? catalog.recentSongs : catalog.azSongs;

  const sortedFavorites = useMemo(() => {
    if (filter !== "Vibed") return [];
    const list = [...favorites];
    if (sort === "recent")
      return list.sort((a, b) => b.createdAt - a.createdAt);
    return list.sort((a, b) =>
      compareText(
        labelsById.get(a.id)?.title ?? normalizeTrackLabels(a.title, a.artist).title,
        labelsById.get(b.id)?.title ?? normalizeTrackLabels(b.title, b.artist).title,
      ),
    );
  }, [favorites, filter, labelsById, sort]);

  const preparedSongs = useMemo(() => {
    if (filter !== "Albums" && filter !== "Artists") return [];
    return catalog.labeled.map(({ song, title, artist }) => ({
      song,
      labels: { title, artist },
    }));
  }, [catalog, filter]);
  const canonicalMap = useMemo(
    () =>
      filter === "Albums" || filter === "Artists"
        ? buildArtistCanonicalMap(preparedSongs.map(({ labels }) => labels.artist))
        : new Map<string, string>(),
    [filter, preparedSongs],
  );

  const albums = useMemo(() => {
    if (filter !== "Albums") return [];
    const map = new Map<string, AlbumRow>();
    for (const { song, labels } of preparedSongs) {
      const artist = clusteredArtistName(labels.artist, canonicalMap);
      const key = `${song.album}::${artistGroupKey(artist)}`;
      const current = map.get(key);
      if (current) {
        current.count += 1;
        current.createdAt = Math.max(current.createdAt, song.createdAt);
        if (!current.artwork && song.artwork) current.artwork = song.artwork;
      } else {
        map.set(key, {
          album: song.album,
          artist,
          count: 1,
          artwork: song.artwork,
          createdAt: song.createdAt,
        });
      }
    }
    const list = [...map.values()];
    if (sort === "recent")
      return list.sort((a, b) => b.createdAt - a.createdAt);
    return list.sort((a, b) => compareText(a.album, b.album));
  }, [canonicalMap, filter, preparedSongs, sort]);

  const artists = useMemo(() => {
    if (filter !== "Artists") return [];
    const map = new Map<string, ArtistRow>();
    for (const { song, labels } of preparedSongs) {
      const artist = clusteredArtistName(labels.artist, canonicalMap);
      const key = artistGroupKey(artist);
      const current = map.get(key);
      if (current) {
        current.count += 1;
        current.createdAt = Math.max(current.createdAt, song.createdAt);
        if (!current.artwork && song.artwork) current.artwork = song.artwork;
      } else {
        map.set(key, {
          artist,
          count: 1,
          artwork: song.artwork,
          createdAt: song.createdAt,
        });
      }
    }
    const list = [...map.values()];
    if (sort === "recent")
      return list.sort((a, b) => b.createdAt - a.createdAt);
    return list.sort((a, b) => compareText(a.artist, b.artist));
  }, [canonicalMap, filter, preparedSongs, sort]);

  const sortedPlaylists = useMemo(() => {
    if (filter !== "Playlists") return [];
    const list = [...playlists];
    if (sort === "recent") {
      list.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      list.sort((a, b) => compareText(a.name, b.name));
    }
    return list.sort(
      (a, b) => Number(isLockedPlaylist(b)) - Number(isLockedPlaylist(a)),
    );
  }, [filter, playlists, sort]);

  const albumRows = useMemo(() => {
    const rows: AlbumListRow[] = [];
    const groups =
      sort === "az"
        ? groupByAzLetter(albums, (item) => item.album)
        : [{ title: "", data: albums }];
    for (const group of groups) {
      if (group.title)
        rows.push({
          type: "letter",
          key: `letter-${group.title}`,
          letter: group.title,
        });
      for (const pair of chunkPairs(group.data)) {
        rows.push({
          type: "pair",
          key: `${pair.left.album}-${pair.left.artist}`,
          left: pair.left,
          right: pair.right,
        });
      }
    }
    return rows;
  }, [albums, sort]);

  const artistRows = useMemo(
    () =>
      flattenAzItems(
        artists,
        (item) => item.artist,
        (item) => item.artist,
        sort === "az",
      ),
    [artists, sort],
  );

  const albumLayouts = useMemo(
    () => layoutsForRows(albumRows, albumRowHeight, AZ_LETTER_HEADER_HEIGHT),
    [albumRowHeight, albumRows],
  );

  const artistLayouts = useMemo(
    () =>
      layoutsForRows(artistRows, ARTIST_ROW_HEIGHT, AZ_LETTER_HEADER_HEIGHT),
    [artistRows],
  );

  const onPlay = useCallback(
    (song: Song, queue: Song[]) => {
      const index = Math.max(
        0,
        queue.findIndex((item) => item.id === song.id),
      );
      playAll(queue, index, false, "all");
    },
    [playAll],
  );

  const onPlayAlbum = useCallback(
    (album: AlbumRow) => {
      const items = sortedSongs.filter((song) => {
        const artist = labelsById.get(song.id)?.artist ?? song.artist;
        return (
          song.album === album.album &&
          artistGroupKey(artist) === artistGroupKey(album.artist)
        );
      });
      if (items.length === 0) return;
      playAll(items, 0, false, "all");
    },
    [labelsById, playAll, sortedSongs],
  );

  const onPlayArtist = useCallback(
    (artist: string) => {
      const key = artistGroupKey(artist);
      const items = sortedSongs.filter(
        (song) =>
          artistGroupKey(labelsById.get(song.id)?.artist ?? song.artist) === key,
      );
      if (items.length === 0) return;
      playAll(items, 0, false, "all");
    },
    [labelsById, playAll, sortedSongs],
  );

  useEffect(() => {
    if (filter !== "Playlists" || playlists.length === 0) return;
    void Promise.all(
      playlists.map(async (playlist) => {
        const items = await getPlaylistSongs(playlist.id);
        return [playlist.id, items.length] as const;
      }),
    ).then((entries) => setPlaylistCounts(Object.fromEntries(entries)));
  }, [filter, playlists]);

  const openFilter = useCallback(() => {
    void Haptics.selectionAsync();
    setFilterOpen(true);
  }, []);

  const [headerHeight, setHeaderHeight] = useState(92);
  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setHeaderHeight((current) => (current === height ? current : height));
  }, []);

  const renderLibraryHeader = useCallback(
    () => (
      <View onLayout={onHeaderLayout}>
        <LibraryHeader
          filter={filter}
          trackCount={songs.length}
          onOpenFilter={openFilter}
        />
      </View>
    ),
    [filter, onHeaderLayout, openFilter, songs.length],
  );

  const getAlbumLayout = useCallback(
    (_: unknown, index: number) => {
      const layout = albumLayouts[index];
      if (!layout)
        return {
          length: albumRowHeight,
          offset: headerHeight + index * albumRowHeight,
          index,
        };
      return {
        length: layout.length,
        offset: headerHeight + layout.offset,
        index,
      };
    },
    [albumLayouts, albumRowHeight, headerHeight],
  );

  const getArtistLayout = useCallback(
    (_: unknown, index: number) => {
      const layout = artistLayouts[index];
      if (!layout)
        return {
          length: ARTIST_ROW_HEIGHT,
          offset: headerHeight + index * ARTIST_ROW_HEIGHT,
          index,
        };
      return {
        length: layout.length,
        offset: headerHeight + layout.offset,
        index,
      };
    },
    [artistLayouts, headerHeight],
  );

  const renderAlbumItem = useCallback(
    ({ item }: { item: AlbumListRow }) => {
      if (item.type === "letter")
        return <AzLetterHeader letter={item.letter} />;
      return (
        <AlbumPairRow
          left={item.left}
          right={item.right}
          size={albumSize}
          height={albumRowHeight}
          onPlayAlbum={onPlayAlbum}
        />
      );
    },
    [albumRowHeight, albumSize, onPlayAlbum],
  );

  const renderArtistItem = useCallback(
    ({
      item,
    }: {
      item: ReturnType<typeof flattenAzItems<ArtistRow>>[number];
    }) => {
      if (item.type === "letter")
        return <AzLetterHeader letter={item.letter} />;
      return <ArtistItem artist={item.item} onPress={onPlayArtist} />;
    },
    [onPlayArtist],
  );

  return (
    <SafeAreaView className="flex-1 bg-vibx-bg" edges={["top"]}>
      <LinearGradient
        colors={["rgba(37, 99, 235, 0.16)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180 }}
      />

      {filter === "Songs" || filter === "Vibed" ? (
        <SongList
          songs={filter === "Vibed" ? sortedFavorites : sortedSongs}
          onPlay={onPlay}
          onLongPress={setSelected}
          groupByLetter={sort === "az"}
          ListHeaderComponent={renderLibraryHeader}
          ListEmptyComponent={filter === "Vibed" ? VibedEmpty : LibraryEmpty}
        />
      ) : null}

      {filter === "Albums" ? (
        <FlatList
          data={albumRows}
          keyExtractor={rowKeyExtractor}
          renderItem={renderAlbumItem}
          ListHeaderComponent={renderLibraryHeader}
          ListEmptyComponent={AlbumsEmpty}
          getItemLayout={getAlbumLayout}
          contentContainerStyle={listContentStyle}
          {...LIST_SCROLL_PROPS}
        />
      ) : null}

      {filter === "Artists" ? (
        <FlatList
          data={artistRows}
          keyExtractor={rowKeyExtractor}
          renderItem={renderArtistItem}
          ListHeaderComponent={renderLibraryHeader}
          ListEmptyComponent={ArtistsEmpty}
          getItemLayout={getArtistLayout}
          contentContainerStyle={listContentStyle}
          {...LIST_SCROLL_PROPS}
        />
      ) : null}

      {filter === "Playlists" ? (
        <ScrollView className="flex-1" contentContainerClassName="pb-28">
          {renderLibraryHeader()}
          {sortedPlaylists.length === 0 ? (
            <EmptyState
              title="No playlists yet"
              subtitle="Long-press a song to create a playlist."
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-5 pt-2"
            >
              {sortedPlaylists.map((playlist) => (
                <PlaylistCard
                  key={playlist.id}
                  id={playlist.id}
                  name={playlist.name}
                  count={playlistCounts[playlist.id]}
                  locked={playlist.locked}
                  onPress={async () => {
                    const items = await getPlaylistSongs(playlist.id);
                    if (items.length === 0) return;
                    playAll(items, 0, false, "all");
                  }}
                />
              ))}
            </ScrollView>
          )}
        </ScrollView>
      ) : null}

      <Modal
        transparent
        animationType="fade"
        visible={filterOpen}
        statusBarTranslucent
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/50"
          onPress={() => setFilterOpen(false)}
        >
          <Pressable
            onPress={() => {}}
            className="absolute overflow-hidden rounded-2xl border border-white/10 bg-vibx-elevated pb-1.5"
            style={{ top: insets.top + 56, right: 20, width: 220 }}
          >
            <Text className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-widest text-vibx-muted">
              Filter
            </Text>
            {FILTERS.map((item) => (
              <FilterMenuRow
                key={item}
                label={item}
                active={filter === item}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setFilter(item);
                  setFilterOpen(false);
                }}
              />
            ))}
            <View className="mx-3 my-1 h-px bg-white/10" />
            <Text className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-vibx-muted">
              Sort
            </Text>
            {SORTS.map((item) => (
              <FilterMenuRow
                key={item.id}
                label={item.label}
                active={sort === item.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSort(item.id);
                  setFilterOpen(false);
                }}
              />
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      <SongContextMenu song={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

const ArtistItem = memo(function ArtistItem({
  artist,
  onPress,
}: {
  artist: ArtistRow;
  onPress: (artist: string) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const { highlightStyle, pressProps } = useRowHighlight();
  const textWidth = Math.max(
    96,
    screenWidth -
      22 * 2 -
      ARTIST_ARTWORK_SIZE -
      16 -
      12,
  );
  return (
    <Pressable
      {...pressProps}
      android_ripple={{ color: "rgba(255,255,255,0.12)" }}
      accessibilityRole="button"
      onPress={() => onPress(artist.artist)}
    >
      <Animated.View style={[styles.artistWrap, highlightStyle]}>
        <View style={styles.artistRow}>
          <View style={styles.artistArtworkSlot}>
            <Artwork
              uri={artist.artwork}
              title={artist.artist}
              size={ARTIST_ARTWORK_SIZE}
              rounded={28}
            />
          </View>
          <View style={[styles.artistMeta, { width: textWidth }]}>
            <Text style={styles.artistName} numberOfLines={1}>
              {artist.artist}
            </Text>
            <Text style={styles.artistCount} numberOfLines={1}>
              {artist.count} {artist.count === 1 ? "song" : "songs"}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

const AlbumPairRow = memo(function AlbumPairRow({
  left,
  right,
  size,
  height,
  onPlayAlbum,
}: {
  left: AlbumRow;
  right?: AlbumRow;
  size: number;
  height: number;
  onPlayAlbum: (album: AlbumRow) => void;
}) {
  return (
    <View style={[styles.albumPair, { height }]}>
      <View style={styles.albumCell}>
        <AlbumCard
          title={left.album}
          subtitle={left.artist}
          artwork={left.artwork}
          count={left.count}
          size={size}
          onPress={() => onPlayAlbum(left)}
        />
      </View>
      <View style={styles.albumCell}>
        {right ? (
          <AlbumCard
            title={right.album}
            subtitle={right.artist}
            artwork={right.artwork}
            count={right.count}
            size={size}
            onPress={() => onPlayAlbum(right)}
          />
        ) : null}
      </View>
    </View>
  );
});

const LibraryHeader = memo(function LibraryHeader({
  filter,
  trackCount,
  onOpenFilter,
}: {
  filter: (typeof FILTERS)[number];
  trackCount: number;
  onOpenFilter: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerEyebrow}>YOUR MUSIC</Text>
          <Text style={styles.headerTitle}>Library</Text>
        </View>
        <Pressable
          hitSlop={12}
          onPress={onOpenFilter}
          accessibilityRole="button"
          accessibilityLabel="Filter and sort library"
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.headerButtonPressed,
          ]}
        >
          <SymbolView
            name={{
              ios: "line.3.horizontal.decrease",
              android: "tune",
              web: "tune",
            }}
            tintColor={colors.text}
            size={20}
          />
        </Pressable>
      </View>
      <Text style={styles.headerSubtitle}>
        {filter} · {trackCount} {trackCount === 1 ? "track" : "tracks"} available
        offline
      </Text>
    </View>
  );
});

function FilterMenuRow({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between px-4 py-3 active:bg-white/5"
    >
      <Text
        className={
          active
            ? "text-[15px] font-semibold text-vibx-text"
            : "text-[15px] text-vibx-muted"
        }
      >
        {label}
      </Text>
      {active ? (
        <SymbolView
          name={{ ios: "checkmark", android: "check", web: "check" }}
          tintColor={colors.accent}
          size={18}
        />
      ) : null}
    </Pressable>
  );
}

function rowKeyExtractor(row: { key: string }) {
  return row.key;
}

const listContentStyle = {
  paddingBottom: 24,
  width: "100%" as const,
};

const styles = StyleSheet.create({
  header: {
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerRow: {
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerEyebrow: {
    marginBottom: 2,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    color: colors.accent,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
    color: colors.text,
  },
  headerButton: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  headerSubtitle: {
    marginTop: 6,
    paddingHorizontal: 22,
    fontSize: 14,
    color: colors.muted,
  },
  artistWrap: {
    height: ARTIST_ROW_HEIGHT,
    alignSelf: "stretch",
    marginHorizontal: 8,
    paddingHorizontal: 14,
    paddingVertical: ARTIST_ROW_PADDING_Y,
    justifyContent: "center",
    cursor: "pointer",
  },
  artistRow: {
    height: ARTIST_ARTWORK_SIZE,
    flexDirection: "row",
    alignItems: "center",
  },
  artistArtworkSlot: {
    width: ARTIST_ARTWORK_SIZE,
    height: ARTIST_ARTWORK_SIZE,
    marginRight: 16,
    flexShrink: 0,
  },
  artistMeta: {
    justifyContent: "center",
    flexShrink: 1,
  },
  artistName: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "600",
    color: colors.text,
    includeFontPadding: false,
  },
  artistCount: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 18,
    color: colors.muted,
    includeFontPadding: false,
  },
  albumPair: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: ALBUM_ROW_GAP,
    gap: 12,
  },
  albumCell: {
    flex: 1,
  },
});
