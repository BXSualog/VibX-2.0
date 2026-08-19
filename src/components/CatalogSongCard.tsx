import { memo, useCallback } from 'react';
import { SongCard } from '@/src/components/SongCard/SongCard';
import { useDownloadStore } from '@/src/stores/downloadStore';
import { useLibraryStore } from '@/src/stores/libraryStore';
import type { Song } from '@/src/types/music';
import { mergeCatalogSong } from '@/src/utils/catalog';

type Props = {
  song: Song;
  rank?: number;
  active?: boolean;
  playing?: boolean;
  onPress: (song: Song) => void;
  onLongPress?: (song: Song) => void;
};

export const CatalogSongCard = memo(function CatalogSongCard({
  song,
  rank,
  active,
  playing,
  onPress,
  onLongPress,
}: Props) {
  const library = useLibraryStore((state) => state.songs);
  const job = useDownloadStore((state) => state.jobs[song.id]);
  const merged = mergeCatalogSong(song, library);
  const downloaded = merged.isDownloaded === 1;
  const progress =
    job?.status === 'downloading' || job?.status === 'queued' ? job.progress : null;

  const handlePress = useCallback(
    (item: Song) => onPress(mergeCatalogSong(item, library)),
    [library, onPress],
  );

  return (
    <SongCard
      song={merged}
      rank={rank}
      active={active}
      playing={playing}
      downloaded={downloaded}
      progress={progress}
      subtitle={`${merged.artist} • ${downloaded ? 'In library' : 'Preview'}`}
      onPress={handlePress}
      onLongPress={onLongPress}
    />
  );
});
