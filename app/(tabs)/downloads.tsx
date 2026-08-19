import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActiveMediaItem, useIsPlaying } from '@rntp/player';
import { EmptyState } from '@/src/components/EmptyState';
import { CatalogSongCard } from '@/src/components/CatalogSongCard';
import { SongContextMenu } from '@/src/components/SongContextMenu';
import { SectionHeader } from '@/src/components/SectionHeader';
import { useDownloadStore } from '@/src/stores/downloadStore';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { usePlayerStore } from '@/src/stores/playerStore';
import { formatBytes } from '@/src/utils/format';
import { isCatalogSongId } from '@/src/utils/catalog';
import type { Song } from '@/src/types/music';

export default function DownloadsScreen() {
  const songs = useLibraryStore((state) => state.songs);
  const jobs = useDownloadStore((state) => state.jobs);
  const storageBytes = useDownloadStore((state) => state.storageBytes);
  const refreshStorage = useDownloadStore((state) => state.refreshStorage);
  const cancelDownload = useDownloadStore((state) => state.cancelDownload);
  const dismissJob = useDownloadStore((state) => state.dismissJob);
  const playSong = usePlayerStore((state) => state.playSong);
  const activeId = useActiveMediaItem()?.mediaId ?? null;
  const playing = useIsPlaying();
  const [selected, setSelected] = useState<Song | null>(null);

  useEffect(() => {
    refreshStorage();
  }, [refreshStorage]);

  const completed = useMemo(
    () => songs.filter((song) => isCatalogSongId(song.id) && song.isDownloaded === 1),
    [songs],
  );
  const inProgress = useMemo(
    () =>
      Object.values(jobs).filter(
        (job) => job.status === 'queued' || job.status === 'downloading',
      ),
    [jobs],
  );
  const blocked = useMemo(
    () =>
      Object.values(jobs).filter(
        (job) => job.status === 'unavailable' || job.status === 'error',
      ),
    [jobs],
  );

  return (
    <SafeAreaView className="flex-1 bg-vibx-bg" edges={['top']}>
      <LinearGradient
        colors={['rgba(37, 99, 235, 0.16)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180 }}
      />
      <ScrollView className="flex-1" contentContainerClassName="pb-28">
        <View className="px-5 pt-3">
          <Text className="text-[34px] font-bold tracking-tight text-vibx-text">Downloads</Text>
          <Text className="mt-1 text-sm text-vibx-muted">
            {formatBytes(storageBytes)} used in VibX
          </Text>
        </View>

        {inProgress.length > 0 ? (
          <>
            <SectionHeader title="In progress" />
            {inProgress.map((job) => (
              <View key={job.songId} className="px-5 pb-3">
                <View className="rounded-2xl bg-vibx-surface px-4 py-3">
                  <Text className="font-semibold text-vibx-text" numberOfLines={1}>
                    {job.title}
                  </Text>
                  <Text className="mt-0.5 text-sm text-vibx-muted" numberOfLines={1}>
                    {job.artist} · {Math.round(job.progress * 100)}%
                  </Text>
                  <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <View
                      className="h-1.5 rounded-full bg-vibx-accent"
                      style={{ width: `${Math.round(job.progress * 100)}%` }}
                    />
                  </View>
                  <Pressable onPress={() => cancelDownload(job.songId)} className="mt-2 self-start">
                    <Text className="text-sm font-semibold text-red-400">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {blocked.length > 0 ? (
          <>
            <SectionHeader title="Needs an authorized file" />
            {blocked.map((job) => (
              <View key={job.songId} className="px-5 pb-3">
                <View className="rounded-2xl bg-vibx-surface px-4 py-3">
                  <Text className="font-semibold text-vibx-text" numberOfLines={1}>
                    {job.title}
                  </Text>
                  <Text className="mt-0.5 text-sm text-vibx-muted">
                    {job.error ?? 'Full track not available yet'}
                  </Text>
                  <Pressable onPress={() => dismissJob(job.songId)} className="mt-2 self-start">
                    <Text className="text-sm font-semibold text-vibx-accent">Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <SectionHeader title="In library" action={`${completed.length}`} />
        {completed.length === 0 && inProgress.length === 0 && blocked.length === 0 ? (
          <EmptyState
            title="No catalog downloads yet"
            subtitle="Browse online, preview a track, then download when an authorized file is available."
          />
        ) : (
          completed.map((song) => (
            <CatalogSongCard
              key={song.id}
              song={song}
              active={song.id === activeId}
              playing={song.id === activeId && playing}
              onPress={(item) => playSong(item, completed)}
              onLongPress={setSelected}
            />
          ))
        )}
      </ScrollView>
      <SongContextMenu
        song={selected}
        queue={completed}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}
