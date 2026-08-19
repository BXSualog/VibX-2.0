import { useEffect } from 'react';
import TrackPlayer, { useActiveMediaItem, useProgress } from '@rntp/player';
import { usePlayerStore } from '@/src/stores/playerStore';
import { resolveSongById } from '@/src/stores/catalogStore';
import { isPreviewSong, previewCap } from '@/src/utils/catalog';

export function usePreviewPlaybackGuard() {
  const item = useActiveMediaItem();
  const progress = useProgress(0.25);
  const pause = usePlayerStore((state) => state.pause);

  useEffect(() => {
    const extras = item?.extras as { preview?: string } | undefined;
    const song = resolveSongById(item?.mediaId);
    const preview = extras?.preview === '1' || isPreviewSong(song);
    if (!preview) return;

    const cap = previewCap(song);
    if (progress.position < cap - 0.15) return;

    pause();
    try {
      TrackPlayer.seekTo(cap);
    } catch {
      // Player may already be idle at the end of the clip.
    }
  }, [item?.mediaId, item?.extras, pause, progress.position]);
}
