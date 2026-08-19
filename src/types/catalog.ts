import type { Song } from '@/src/types/music';

export type CatalogAlbum = {
  id: number;
  title: string;
  artist: string;
  artwork: string | null;
  trackCount: number;
};

export type CatalogArtist = {
  id: number;
  name: string;
  artwork: string | null;
  fans: number;
};

export type CatalogGenre = {
  id: number;
  name: string;
};

export type CatalogSearchResults = {
  songs: Song[];
  albums: CatalogAlbum[];
  artists: CatalogArtist[];
};

export type CatalogChart = {
  tracks: Song[];
  albums: CatalogAlbum[];
  artists: CatalogArtist[];
};

export type CatalogCollection = {
  id: number;
  title: string;
  subtitle: string;
  artwork: string | null;
  tracks: Song[];
};

export type DownloadJobStatus =
  | 'queued'
  | 'downloading'
  | 'done'
  | 'error'
  | 'unavailable';

export type DownloadJob = {
  songId: string;
  title: string;
  artist: string;
  artwork: string | null;
  progress: number;
  status: DownloadJobStatus;
  error?: string;
};
