import { useEffect, useMemo, useState } from 'react';
import { InteractionManager, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SearchBar } from '@/src/components/SearchBar/SearchBar';
import { SongCard } from '@/src/components/SongCard/SongCard';
import { PlaylistCard } from '@/src/components/PlaylistCard/PlaylistCard';
import { ArtistAlbumCard } from '@/src/components/ArtistAlbumCard/ArtistAlbumCard';
import { SectionHeader } from '@/src/components/SectionHeader';
import { EmptyState } from '@/src/components/EmptyState';
import { VyzeHeader } from '@/src/components/Vyze/VyzeHeader';
import { SongContextMenu } from '@/src/components/SongContextMenu';
import { Artwork } from '@/src/components/Artwork';
import { useActiveMediaItem, useIsPlaying } from '@rntp/player';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { usePlayerStore } from '@/src/stores/playerStore';
import { getPlaylistSongs } from '@/src/services/database';
import { colors } from '@/src/theme/colors';
import { greetingForNow } from '@/src/utils/format';
import type { Song } from '@/src/types/music';
import { normalizeTrackLabels } from '@/src/utils/metadata';
import { artistAlbumsFromSongs } from '@/src/utils/artistAlbums';
import { getSearchCatalog } from '@/src/utils/searchCatalog';

export default function HomeScreen() {
  const songs = useLibraryStore((state) => state.songs);
  const recent = useLibraryStore((state) => state.recent);
  const playlists = useLibraryStore((state) => state.playlists);
  const playSong = usePlayerStore((state) => state.playSong);
  const playAll = usePlayerStore((state) => state.playAll);
  const activeId = useActiveMediaItem()?.mediaId ?? null;
  const playing = useIsPlaying();
  const [selected, setSelected] = useState<Song | null>(null);
  const [playlistCounts, setPlaylistCounts] = useState<Record<string, number>>({});

  const continueListening = recent[0] ?? songs[0];
  const continueLabels = continueListening
    ? normalizeTrackLabels(continueListening.title, continueListening.artist)
    : null;
  const recentSongs = recent.slice(0, 8);
  const artistAlbums = useMemo(() => artistAlbumsFromSongs(songs), [songs]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      router.prefetch('/search');
      getSearchCatalog(songs, playlists);
    });
    return () => task.cancel();
  }, [playlists, songs]);

  useEffect(() => {
    if (playlists.length === 0) {
      setPlaylistCounts({});
      return;
    }
    void Promise.all(
      playlists.map(async (playlist) => {
        const items = await getPlaylistSongs(playlist.id);
        return [playlist.id, items.length] as const;
      }),
    ).then((entries) => setPlaylistCounts(Object.fromEntries(entries)));
  }, [playlists]);

  return (
    <SafeAreaView className="flex-1 bg-vibx-bg" edges={['top']}>
      <LinearGradient
        colors={['rgba(37, 99, 235, 0.22)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 240 }}
      />

      <ScrollView className="flex-1" contentContainerClassName="pb-16" keyboardShouldPersistTaps="handled">
        <View className="px-5 pt-3">
          <Text className="text-sm font-medium text-vibx-muted">{greetingForNow()}</Text>
          <Text className="mt-0.5 text-[34px] font-bold tracking-tight text-vibx-text">
            VibX 2.0
          </Text>
        </View>
        <SearchBar
          onPress={() => {
            requestAnimationFrame(() => router.push('/search'));
          }}
        />
        <VyzeHeader />

        {continueListening && continueLabels ? (
          <>
            <SectionHeader title="Continue Listening" />
            <Pressable
              onPress={() => playSong(continueListening, songs)}
              className="mx-5 overflow-hidden rounded-3xl bg-vibx-surface"
            >
              <LinearGradient
                colors={['#1E3A8A', '#111827']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}
              >
                <Artwork
                  uri={continueListening.artwork}
                  title={continueLabels.title}
                  artist={continueLabels.artist}
                  size={72}
                  rounded={14}
                />
                <View className="ml-3.5 flex-1">
                  <Text className="text-xs font-semibold uppercase tracking-widest text-vibx-accent">
                    Pick up where you left off
                  </Text>
                  <Text className="mt-1 text-lg font-bold text-vibx-text" numberOfLines={1}>
                    {continueLabels.title}
                  </Text>
                  <Text className="text-sm text-vibx-muted" numberOfLines={1}>
                    {continueLabels.artist}
                  </Text>
                </View>
                <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
                  <SymbolView
                    name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                    tintColor={colors.background}
                    size={22}
                  />
                </View>
              </LinearGradient>
            </Pressable>
          </>
        ) : null}

        <SectionHeader title="Recently Played" />
        {recentSongs.length === 0 ? (
          <EmptyState title="Nothing played yet" subtitle="Start a track and it will show up here." />
        ) : (
          recentSongs.map((song) => (
            <SongCard
              key={`recent-${song.id}`}
              song={song}
              active={song.id === activeId}
              playing={song.id === activeId && playing}
              onPress={(item) => playSong(item, songs)}
              onLongPress={setSelected}
            />
          ))
        )}

        <SectionHeader title="Playlists" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-5 pb-2"
          decelerationRate="fast"
        >
          {playlists.map((playlist) => (
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

        {artistAlbums.length > 0 ? (
          <>
            <SectionHeader title="Albums" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-5 pb-2"
              decelerationRate="fast"
            >
              {artistAlbums.map((album) => (
                <View key={album.artist} className="mr-4">
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
      </ScrollView>
      <SongContextMenu song={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}
