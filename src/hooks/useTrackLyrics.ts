import { useEffect, useState } from 'react';
import { loadTrackLyrics, type TrackLyrics } from '@/src/services/lyrics/loadLyrics';
import type { Song } from '@/src/types/music';

export function useTrackLyrics(song?: Song | null, duration = 0): TrackLyrics | null | undefined {
  const [lyrics, setLyrics] = useState<TrackLyrics | null | undefined>(undefined);
  const seconds = duration > 1 ? duration : song?.duration ?? 0;
  const rounded = Math.round(seconds || 0);

  useEffect(() => {
    setLyrics(undefined);
  }, [song?.id]);

  useEffect(() => {
    if (!song?.localPath) {
      setLyrics(null);
      return;
    }

    let cancelled = false;
    void loadTrackLyrics(song, seconds).then((result) => {
      if (!cancelled) setLyrics(result);
    });

    return () => {
      cancelled = true;
    };
  }, [song?.id, song?.localPath, rounded]);

  return lyrics;
}
