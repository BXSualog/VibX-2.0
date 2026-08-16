export const VIBED_PLAYLIST_ID = 'vibed';

export function isLockedPlaylist(playlist: { id: string; locked?: number }): boolean {
  return playlist.id === VIBED_PLAYLIST_ID || playlist.locked === 1;
}
