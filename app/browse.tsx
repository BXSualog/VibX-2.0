import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SearchBar } from '@/src/components/SearchBar/SearchBar';
import { CatalogSongCard } from '@/src/components/CatalogSongCard';
import { ArtistAlbumCard } from '@/src/components/ArtistAlbumCard/ArtistAlbumCard';
import { SectionHeader } from '@/src/components/SectionHeader';
import { EmptyState } from '@/src/components/EmptyState';
import { SongContextMenu } from '@/src/components/SongContextMenu';
import { MINI_PLAYER_HEIGHT } from '@/src/components/MiniPlayer/MiniPlayer';
import { MiniPlayerDock } from '@/src/components/MiniPlayer/MiniPlayerDock';
import { useActiveMediaItem, useIsPlaying } from '@rntp/player';
import { usePlayerStore } from '@/src/stores/playerStore';
import { useLibraryStore } from '@/src/stores/libraryStore';
import {
  fetchChart,
  fetchGenres,
  searchCatalog,
} from '@/src/services/catalog/deezer';
import { colors } from '@/src/theme/colors';
import type { CatalogChart, CatalogGenre, CatalogSearchResults } from '@/src/types/catalog';
import type { Song } from '@/src/types/music';
import { catalogErrorMessage, mergeCatalogSongs } from '@/src/utils/catalog';

const EMPTY_SEARCH: CatalogSearchResults = { songs: [], albums: [], artists: [] };

export default function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const playSong = usePlayerStore((state) => state.playSong);
  const library = useLibraryStore((state) => state.songs);
  const activeId = useActiveMediaItem()?.mediaId ?? null;
  const playing = useIsPlaying();
  const [query, setQuery] = useState('');
  const [genreId, setGenreId] = useState(0);
  const [genres, setGenres] = useState<CatalogGenre[]>([]);
  const [chart, setChart] = useState<CatalogChart>({ tracks: [], albums: [], artists: [] });
  const [results, setResults] = useState<CatalogSearchResults>(EMPTY_SEARCH);
  const [loadingChart, setLoadingChart] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Song | null>(null);

  const q = query.trim();
  const searching = q.length > 0;

  useEffect(() => {
    let cancelled = false;
    void fetchGenres()
      .then((items) => {
        if (!cancelled) setGenres(items);
      })
      .catch(() => {
        if (!cancelled) setGenres([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (searching) return;
    let cancelled = false;
    setLoadingChart(true);
    setError(null);
    void fetchChart(genreId)
      .then((next) => {
        if (!cancelled) setChart(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setChart({ tracks: [], albums: [], artists: [] });
          setError(catalogErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingChart(false);
      });
    return () => {
      cancelled = true;
    };
  }, [genreId, searching]);

  useEffect(() => {
    if (!searching) {
      setResults(EMPTY_SEARCH);
      setLoadingSearch(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setLoadingSearch(true);
      setError(null);
      void searchCatalog(q)
        .then((next) => {
          if (!cancelled) setResults(next);
        })
        .catch((err) => {
          if (!cancelled) {
            setResults(EMPTY_SEARCH);
            setError(catalogErrorMessage(err));
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingSearch(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, searching]);

  const visibleTracks = searching ? results.songs : chart.tracks;
  const albums = searching ? results.albums : chart.albums;
  const artists = searching ? results.artists : chart.artists;
  const queue = useMemo(
    () => mergeCatalogSongs(visibleTracks, library).filter((song) => song.previewUrl || song.isDownloaded),
    [library, visibleTracks],
  );
  const hasResults =
    visibleTracks.length > 0 || albums.length > 0 || artists.length > 0;
  const loading = searching ? loadingSearch : loadingChart;

  const onPlaySong = useCallback(
    (song: Song) => {
      playSong(song, queue);
    },
    [playSong, queue],
  );

  return (
    <SafeAreaView className="flex-1 bg-vibx-bg" edges={['top']}>
      <LinearGradient
        colors={['rgba(37, 99, 235, 0.22)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 240 }}
      />

      <View className="flex-row items-center px-3 pt-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          className="h-10 w-10 items-center justify-center"
        >
          <SymbolView
            name={{
              ios: 'chevron.left',
              android: 'arrow_back',
              web: 'arrow_back',
            }}
            tintColor={colors.text}
            size={22}
          />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[34px] font-bold tracking-tight text-vibx-text">Browse</Text>
          <Text className="text-sm text-vibx-muted">Online catalog · 30s previews</Text>
        </View>
      </View>

      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search artists, songs, albums"
      />

      {!searching ? (
        <View style={{ height: 52, marginTop: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              alignItems: 'center',
            }}
          >
            <GenreChip
              label="All"
              active={genreId === 0}
              onPress={() => setGenreId(0)}
            />
            {genres.map((genre) => (
              <GenreChip
                key={genre.id}
                label={genre.name}
                active={genreId === genre.id}
                onPress={() => setGenreId(genre.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: MINI_PLAYER_HEIGHT + Math.max(insets.bottom, 12) + 72,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}

        {!loading && error ? (
          <EmptyState title="Connect to browse the catalog" subtitle={error} />
        ) : null}

        {!loading && !error && !hasResults ? (
          <EmptyState
            title={searching ? 'No matches' : 'Nothing to browse yet'}
            subtitle={
              searching
                ? 'Try another artist or song title.'
                : 'Check your connection and try again.'
            }
          />
        ) : null}

        {!loading && !error && albums.length > 0 ? (
          <>
            <SectionHeader title={searching ? 'Albums' : 'Trending albums'} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-5 pb-2"
              decelerationRate="fast"
            >
              {albums.map((album) => (
                <View key={album.id} className="mr-4">
                  <ArtistAlbumCard
                    artist={album.title}
                    count={album.trackCount}
                    artwork={album.artwork}
                    size={152}
                    kind="album"
                    onPress={() =>
                      router.push({
                        pathname: '/catalog-album',
                        params: { id: String(album.id) },
                      })
                    }
                  />
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        {!loading && !error && artists.length > 0 ? (
          <>
            <SectionHeader title={searching ? 'Artists' : 'Trending artists'} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-5 pb-2"
              decelerationRate="fast"
            >
              {artists.map((artist) => (
                <View key={artist.id} className="mr-4">
                  <ArtistAlbumCard
                    artist={artist.name}
                    count={artist.fans}
                    artwork={artist.artwork}
                    size={152}
                    kind="artist"
                    onPress={() =>
                      router.push({
                        pathname: '/catalog-artist',
                        params: { id: String(artist.id) },
                      })
                    }
                  />
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        {!loading && !error && visibleTracks.length > 0 ? (
          <>
            <SectionHeader title={searching ? 'Songs' : 'Trending'} action="Online" />
            {visibleTracks.map((song, index) => (
              <CatalogSongCard
                key={song.id}
                song={song}
                rank={searching ? undefined : index + 1}
                active={song.id === activeId}
                playing={song.id === activeId && playing}
                onPress={onPlaySong}
                onLongPress={setSelected}
              />
            ))}
          </>
        ) : null}
      </ScrollView>
      <SongContextMenu song={selected} queue={queue} onClose={() => setSelected(null)} />
      <MiniPlayerDock />
    </SafeAreaView>
  );
}

function GenreChip({
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
      className={`mr-2 h-9 items-center justify-center rounded-full px-4 ${
        active ? 'bg-vibx-primary' : 'bg-vibx-elevated'
      }`}
    >
      <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-vibx-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
