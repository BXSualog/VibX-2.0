export type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  previewUrl: string | null;
  downloadUrl: string | null;
  duration: number;
  previewDuration: number;
  artwork: string | null;
  localPath: string;
  isDownloaded: number;
  isDemo: number;
  createdAt: number;
};

export type Playlist = {
  id: string;
  name: string;
  createdAt: number;
  locked: number;
};

export type PlaylistSong = {
  playlistId: string;
  songId: string;
  position: number;
};

export type RepeatModeName = 'off' | 'one' | 'all';

export type VyzeIntent =
  | { action: 'pause' }
  | { action: 'resume' }
  | { action: 'stop' }
  | { action: 'shuffle' }
  | { action: 'vibe' }
  | { action: 'random' }
  | { action: 'next' }
  | { action: 'previous' }
  | { action: 'favorites' }
  | { action: 'downloaded' }
  | { action: 'nowplaying' }
  | { action: 'randomalbum' }
  | { action: 'randomplaylist' }
  | { action: 'queue' }
  | { action: 'play'; query: string; title?: string; artist?: string }
  | { action: 'unknown' };
