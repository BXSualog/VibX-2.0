import type { Song } from '@/src/types/music';

export function isCatalogSongId(id: string | undefined | null): boolean {
  return Boolean(id?.startsWith('deezer-'));
}

export function isCatalogSong(song: Song | undefined | null): boolean {
  return Boolean(song && isCatalogSongId(song.id));
}

export function isPreviewSong(song: Song | undefined | null): boolean {
  return Boolean(song && !song.isDownloaded && song.previewUrl);
}

export function previewCap(song: Song | undefined | null): number {
  if (!song) return 30;
  return song.previewDuration > 0 ? song.previewDuration : 30;
}

export function mergeCatalogSong(song: Song, library: Song[]): Song {
  const local = library.find((item) => item.id === song.id);
  return local?.isDownloaded ? local : song;
}

export function mergeCatalogSongs(songs: Song[], library: Song[]): Song[] {
  if (library.length === 0) return songs;
  return songs.map((song) => mergeCatalogSong(song, library));
}

export function catalogErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (
    error instanceof TypeError ||
    /network|failed to fetch|offline|internet/i.test(message)
  ) {
    return 'Connect to browse the catalog';
  }
  return message || 'Could not load online catalog';
}
