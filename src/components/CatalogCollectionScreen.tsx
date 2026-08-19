import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CatalogSongCard } from '@/src/components/CatalogSongCard';
import { EmptyState } from '@/src/components/EmptyState';
import { SongContextMenu } from '@/src/components/SongContextMenu';
import { MINI_PLAYER_HEIGHT } from '@/src/components/MiniPlayer/MiniPlayer';
import { MiniPlayerDock } from '@/src/components/MiniPlayer/MiniPlayerDock';
import { useActiveMediaItem, useIsPlaying } from '@rntp/player';
import { usePlayerStore } from '@/src/stores/playerStore';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { colors } from '@/src/theme/colors';
import { brightCoverPalette } from '@/src/utils/cover';
import { catalogErrorMessage, mergeCatalogSongs } from '@/src/utils/catalog';
import type { CatalogCollection } from '@/src/types/catalog';
import type { Song } from '@/src/types/music';

type Props = {
  kind: 'album' | 'artist';
  load: () => Promise<CatalogCollection>;
};

export function CatalogCollectionScreen({ kind, load }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const playAll = usePlayerStore((state) => state.playAll);
  const playSong = usePlayerStore((state) => state.playSong);
  const library = useLibraryStore((state) => state.songs);
  const activeId = useActiveMediaItem()?.mediaId ?? null;
  const playing = useIsPlaying();
  const [collection, setCollection] = useState<CatalogCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Song | null>(null);
  const coverSize = Math.min(220, Math.round(width * 0.58));
  const palette = brightCoverPalette(collection?.title ?? kind, collection?.subtitle ?? 'catalog');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void load()
      .then((next) => {
        if (!cancelled) setCollection(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setCollection(null);
          setError(catalogErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const tracks = useMemo(
    () => mergeCatalogSongs(collection?.tracks ?? [], library),
    [collection?.tracks, library],
  );
  const queue = tracks.filter((song) => song.previewUrl || song.isDownloaded);

  const onPlay = useCallback(() => {
    if (queue.length === 0) return;
    playAll(queue, 0, false, 'all');
  }, [playAll, queue]);

  const onPlayTrack = useCallback(
    (song: Song) => {
      playSong(song, queue);
    },
    [playSong, queue],
  );

  return (
    <SafeAreaView className="flex-1 bg-vibx-bg" edges={['top']}>
      <LinearGradient
        colors={[palette[1], colors.background]}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: MINI_PLAYER_HEIGHT + Math.max(insets.bottom, 12) + 48,
        }}
      >
        <View className="px-6">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="-ml-2 h-10 w-10 items-center justify-center"
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
        </View>

        {loading ? (
          <View className="items-center py-20">
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}

        {!loading && (error || !collection) ? (
          <EmptyState
            title="Connect to browse the catalog"
            subtitle={error ?? 'This collection could not be loaded.'}
          />
        ) : null}

        {!loading && collection ? (
          <>
            <View className="items-center px-6">
              <View
                className="overflow-hidden rounded-2xl"
                style={{ width: coverSize, height: coverSize }}
              >
                {collection.artwork ? (
                  <Image
                    source={{ uri: collection.artwork }}
                    style={{ width: coverSize, height: coverSize }}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient
                    colors={[palette[0], palette[1], colors.primary]}
                    style={{
                      width: coverSize,
                      height: coverSize,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SymbolView
                      name={{
                        ios: kind === 'artist' ? 'person.fill' : 'music.note',
                        android: kind === 'artist' ? 'person' : 'album',
                        web: kind === 'artist' ? 'person' : 'album',
                      }}
                      tintColor="#FFFFFF"
                      size={Math.round(coverSize * 0.34)}
                    />
                  </LinearGradient>
                )}
              </View>
              <Text className="mt-4 text-[11px] font-bold tracking-[1.6px] text-vibx-accent">
                {kind === 'artist' ? 'ARTIST' : 'ALBUM'}
              </Text>
              <Text className="mt-1.5 text-center text-[32px] font-extrabold text-vibx-text">
                {collection.title}
              </Text>
              <Text className="mt-2 text-[13px] text-vibx-muted">
                {collection.subtitle}
                {`  ·  ${tracks.length} ${tracks.length === 1 ? 'song' : 'songs'}`}
              </Text>
            </View>

            <Pressable
              onPress={onPlay}
              className="mx-6 mt-6 h-12 flex-row items-center justify-center rounded-full bg-vibx-primary"
            >
              <Text className="text-[16px] font-extrabold text-white">Play previews</Text>
            </Pressable>

            <View className="mt-6">
              {tracks.map((song) => (
                <CatalogSongCard
                  key={song.id}
                  song={song}
                  active={song.id === activeId}
                  playing={song.id === activeId && playing}
                  onPress={onPlayTrack}
                  onLongPress={setSelected}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
      <SongContextMenu song={selected} queue={queue} onClose={() => setSelected(null)} />
      <MiniPlayerDock />
    </SafeAreaView>
  );
}
