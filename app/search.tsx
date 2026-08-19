import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SearchBar } from '@/src/components/SearchBar/SearchBar';
import { SongCard } from '@/src/components/SongCard/SongCard';
import { PlaylistCard } from '@/src/components/PlaylistCard/PlaylistCard';
import { ArtistAlbumCard } from '@/src/components/ArtistAlbumCard/ArtistAlbumCard';
import { SectionHeader } from '@/src/components/SectionHeader';
import { EmptyState } from '@/src/components/EmptyState';
import { SongContextMenu } from '@/src/components/SongContextMenu';
import { MINI_PLAYER_HEIGHT } from '@/src/components/MiniPlayer/MiniPlayer';
import { MiniPlayerDock } from '@/src/components/MiniPlayer/MiniPlayerDock';
import { useActiveMediaItem, useIsPlaying } from '@rntp/player';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { usePlayerStore } from '@/src/stores/playerStore';
import { getPlaylistSongs } from '@/src/services/database';
import { colors } from '@/src/theme/colors';
import type { Song } from '@/src/types/music';
import {
  getSearchCatalog,
  searchArtistAlbums,
  searchNamedAlbums,
  searchPlaylists,
  searchSongs,
} from '@/src/utils/searchCatalog';

export default function SearchScreen() {
  const songs = useLibraryStore((state) => state.songs);
  const playlists = useLibraryStore((state) => state.playlists);
  const recent = useLibraryStore((state) => state.recent);
  const popular = useLibraryStore((state) => state.popular);
  const playStats = useLibraryStore((state) => state.playStats);
  const playSong = usePlayerStore((state) => state.playSong);
  const playAll = usePlayerStore((state) => state.playAll);
  const activeId = useActiveMediaItem()?.mediaId ?? null;
  const playing = useIsPlaying();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Song | null>(null);
  const [playlistCounts, setPlaylistCounts] = useState<Record<string, number>>({});

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      inputRef.current?.focus();
    });
    return () => task.cancel();
  }, []);

  const catalog = useMemo(() => getSearchCatalog(songs, playlists), [playlists, songs]);

  const songResults = useMemo(
    () => (searching && catalog ? searchSongs(catalog.songs, q) : []),
    [catalog, q, searching],
  );
  const namedAlbumResults = useMemo(
    () => (searching && catalog ? searchNamedAlbums(catalog.namedAlbums, q) : []),
    [catalog, q, searching],
  );
  const artistAlbumResults = useMemo(
    () => (searching && catalog ? searchArtistAlbums(catalog.artistAlbums, q) : []),
    [catalog, q, searching],
  );
  const playlistResults = useMemo(
    () => (searching && catalog ? searchPlaylists(catalog.playlists, q) : []),
    [catalog, q, searching],
  );

  const hasAlbumResults = namedAlbumResults.length > 0 || artistAlbumResults.length > 0;
  const hasResults =
    songResults.length > 0 || hasAlbumResults || playlistResults.length > 0;
  const recentSongs = recent.filter((song) => song?.id).slice(0, 7);
  const popularSongs = popular.filter((song) => song?.id).slice(0, 8);
  const recommendedAlbums = useMemo(() => {
    if (!catalog) return [];
    const albums =
      catalog.artistAlbums.length > 0
        ? catalog.artistAlbums.map((album) => ({
            key: album.artist,
            title: album.artist,
            count: album.songs.length,
            artwork: album.artwork,
            songs: album.songs,
            openAlbum: true,
            score: album.songs.reduce((total, song) => total + (playStats[song.id] ?? 0), 0),
          }))
        : catalog.namedAlbums.map((album) => ({
            key: `${album.album}-${album.artist}`,
            title: album.album,
            count: album.songs.length,
            artwork: album.artwork,
            songs: album.songs,
            openAlbum: false,
            score: album.songs.reduce((total, song) => total + (playStats[song.id] ?? 0), 0),
          }));
    return albums
      .sort((left, right) => right.score - left.score || right.count - left.count)
      .slice(0, 8);
  }, [catalog, playStats]);
  const hasDiscover =
    recentSongs.length > 0 || popularSongs.length > 0 || recommendedAlbums.length > 0;

  useEffect(() => {
    if (!searching || playlistResults.length === 0) return;
    let cancelled = false;
    void Promise.all(
      playlistResults.map(async (playlist) => {
        const items = await getPlaylistSongs(playlist.id);
        return [playlist.id, items.length] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setPlaylistCounts((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
  }, [playlistResults, searching]);

  const onPlaySong = useCallback(
    (song: Song) => {
      playSong(song, songs);
    },
    [playSong, songs],
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
        <Text className="flex-1 text-[34px] font-bold tracking-tight text-vibx-text">
          Search
        </Text>
      </View>

      <SearchBar inputRef={inputRef} value={query} onChangeText={setQuery} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: MINI_PLAYER_HEIGHT + Math.max(insets.bottom, 12) + 72,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {!searching ? (
          hasDiscover ? (
            <>
              {recentSongs.length > 0 ? (
                <>
                  <SectionHeader title="Recently Played" />
                  {recentSongs.map((song) => (
                    <SongCard
                      key={`recent-${song.id}`}
                      song={song}
                      active={song.id === activeId}
                      playing={song.id === activeId && playing}
                      onPress={onPlaySong}
                      onLongPress={setSelected}
                    />
                  ))}
                </>
              ) : null}

              {popularSongs.length > 0 ? (
                <>
                  <SectionHeader title="Popular" />
                  {popularSongs.map((song, index) => (
                    <SongCard
                      key={`popular-${song.id}`}
                      song={song}
                      rank={index + 1}
                      active={song.id === activeId}
                      playing={song.id === activeId && playing}
                      onPress={onPlaySong}
                      onLongPress={setSelected}
                    />
                  ))}
                </>
              ) : null}

              {recommendedAlbums.length > 0 ? (
                <>
                  <SectionHeader title="Recommended Albums" />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="px-5 pb-2"
                    decelerationRate="fast"
                    keyboardShouldPersistTaps="handled"
                  >
                    {recommendedAlbums.map((album) => (
                      <View key={album.key} className="mr-4">
                        <ArtistAlbumCard
                          artist={album.title}
                          count={album.count}
                          artwork={album.artwork}
                          size={152}
                          onPress={() => {
                            if (album.openAlbum) {
                              router.push({
                                pathname: '/album',
                                params: { artist: album.title },
                              });
                              return;
                            }
                            playAll(album.songs, 0, false, 'all');
                          }}
                        />
                      </View>
                    ))}
                  </ScrollView>
                </>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="Find something to play"
              subtitle="Type a song, album, or playlist from your library."
            />
          )
        ) : !hasResults ? (
          <EmptyState
            title="No matches"
            subtitle="Try a song, album, or playlist from your library."
          />
        ) : (
          <>
            {songResults.length > 0 ? (
              <>
                <SectionHeader title="Songs" />
                {songResults.map((song) => (
                  <SongCard
                    key={song.id}
                    song={song}
                    active={song.id === activeId}
                    playing={song.id === activeId && playing}
                    onPress={onPlaySong}
                    onLongPress={setSelected}
                  />
                ))}
              </>
            ) : null}

            {hasAlbumResults ? (
              <>
                <SectionHeader title="Albums" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="px-5 pb-2"
                  decelerationRate="fast"
                  keyboardShouldPersistTaps="handled"
                >
                  {namedAlbumResults.map((album) => (
                    <View key={`${album.album}-${album.artist}`} className="mr-4">
                      <ArtistAlbumCard
                        artist={album.album}
                        count={album.songs.length}
                        artwork={album.artwork}
                        size={152}
                        onPress={() => playAll(album.songs, 0, false, 'all')}
                      />
                    </View>
                  ))}
                  {artistAlbumResults.map((album) => (
                    <View key={`artist-${album.artist}`} className="mr-4">
                      <ArtistAlbumCard
                        artist={album.artist}
                        count={album.songs.length}
                        artwork={album.artwork}
                        size={152}
                        onPress={() =>
                          router.push({
                            pathname: '/album',
                            params: { artist: album.artist },
                          })
                        }
                      />
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : null}

            {playlistResults.length > 0 ? (
              <>
                <SectionHeader title="Playlists" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName="px-5 pb-2"
                  decelerationRate="fast"
                  keyboardShouldPersistTaps="handled"
                >
                  {playlistResults.map((playlist) => (
                    <View key={playlist.id} className="mr-4">
                      <PlaylistCard
                        id={playlist.id}
                        name={playlist.name}
                        count={playlistCounts[playlist.id]}
                        locked={playlist.locked}
                        size={152}
                        onPress={async () => {
                          const items = await getPlaylistSongs(playlist.id);
                          if (items.length === 0) return;
                          playAll(items, 0, false, 'all');
                        }}
                      />
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <SongContextMenu song={selected} onClose={() => setSelected(null)} />
      <MiniPlayerDock />
    </SafeAreaView>
  );
}
