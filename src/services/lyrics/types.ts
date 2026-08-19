import type { LyricLine } from '@/src/utils/lrc';

export type TrackLyrics = {
  lines: LyricLine[];
  synced: boolean;
  source?: 'local' | 'id3' | 'lrclib' | 'lyricsovh';
  raw?: string;
};
