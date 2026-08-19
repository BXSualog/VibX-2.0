import type {
  CatalogAlbum,
  CatalogArtist,
  CatalogChart,
  CatalogCollection,
  CatalogGenre,
  CatalogSearchResults,
} from '@/src/types/catalog';
import type { Song } from '@/src/types/music';

const BASE = 'https://api.deezer.com';

type DeezerArtist = {
  id?: number;
  name: string;
  picture_medium?: string;
  picture_xl?: string;
  nb_fan?: number;
};

type DeezerAlbum = {
  id?: number;
  title: string;
  cover_medium?: string;
  cover_xl?: string;
  nb_tracks?: number;
  artist?: DeezerArtist;
};

type DeezerTrack = {
  id: number;
  title: string;
  duration: number;
  preview: string;
  artist: DeezerArtist;
  album: DeezerAlbum;
};

type DeezerGenre = {
  id: number;
  name: string;
};

type DeezerList<T> = {
  data: T[];
};

type DeezerChartResponse = {
  tracks?: DeezerList<DeezerTrack>;
  albums?: DeezerList<DeezerAlbum>;
  artists?: DeezerList<DeezerArtist>;
};

type DeezerAlbumResponse = DeezerAlbum & {
  tracks?: DeezerList<DeezerTrack>;
};

type DeezerArtistResponse = DeezerArtist & {
  nb_fan?: number;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) {
    throw new Error(`Deezer request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function artwork(...values: Array<string | undefined | null>): string | null {
  return values.find((value) => Boolean(value)) ?? null;
}

export function catalogTrackToSong(track: DeezerTrack): Song {
  return {
    id: `deezer-${track.id}`,
    title: track.title,
    artist: track.artist?.name ?? 'Unknown artist',
    album: track.album?.title ?? '',
    previewUrl: track.preview || null,
    downloadUrl: null,
    duration: track.duration,
    previewDuration: 30,
    artwork: artwork(track.album?.cover_xl, track.album?.cover_medium),
    localPath: track.preview || '',
    isDownloaded: 0,
    isDemo: 0,
    createdAt: Date.now(),
  };
}

function toAlbum(album: DeezerAlbum): CatalogAlbum | null {
  if (!album.id) return null;
  return {
    id: album.id,
    title: album.title,
    artist: album.artist?.name ?? 'Unknown artist',
    artwork: artwork(album.cover_xl, album.cover_medium),
    trackCount: album.nb_tracks ?? 0,
  };
}

function toArtist(artist: DeezerArtist): CatalogArtist | null {
  if (!artist.id) return null;
  return {
    id: artist.id,
    name: artist.name,
    artwork: artwork(artist.picture_xl, artist.picture_medium),
    fans: artist.nb_fan ?? 0,
  };
}

export async function fetchGenres(): Promise<CatalogGenre[]> {
  const payload = await fetchJson<DeezerList<DeezerGenre>>('/genre');
  return payload.data
    .filter((genre) => genre.id > 0 && genre.name.trim().toLowerCase() !== 'all')
    .slice(0, 24)
    .map((genre) => ({ id: genre.id, name: genre.name }));
}

export async function fetchChart(genreId = 0): Promise<CatalogChart> {
  const path = genreId > 0 ? `/chart/${genreId}` : '/chart';
  const payload = await fetchJson<DeezerChartResponse>(path);
  return {
    tracks: (payload.tracks?.data ?? []).slice(0, 25).map(catalogTrackToSong),
    albums: (payload.albums?.data ?? [])
      .map(toAlbum)
      .filter((album): album is CatalogAlbum => Boolean(album))
      .slice(0, 12),
    artists: (payload.artists?.data ?? [])
      .map(toArtist)
      .filter((artist): artist is CatalogArtist => Boolean(artist))
      .slice(0, 12),
  };
}

export async function fetchChartTracks(limit = 25): Promise<Song[]> {
  const chart = await fetchChart();
  return chart.tracks.slice(0, limit);
}

export async function searchCatalog(query: string): Promise<CatalogSearchResults> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { songs: [], albums: [], artists: [] };
  }
  const encoded = encodeURIComponent(trimmed);
  const [songs, albums, artists] = await Promise.all([
    fetchJson<DeezerList<DeezerTrack>>(`/search?q=${encoded}&limit=20`),
    fetchJson<DeezerList<DeezerAlbum>>(`/search/album?q=${encoded}&limit=12`),
    fetchJson<DeezerList<DeezerArtist>>(`/search/artist?q=${encoded}&limit=12`),
  ]);
  return {
    songs: songs.data.map(catalogTrackToSong),
    albums: albums.data
      .map(toAlbum)
      .filter((album): album is CatalogAlbum => Boolean(album)),
    artists: artists.data
      .map(toArtist)
      .filter((artist): artist is CatalogArtist => Boolean(artist)),
  };
}

export async function searchCatalogTracks(query: string, limit = 30): Promise<Song[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const payload = await fetchJson<DeezerList<DeezerTrack>>(
    `/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
  );
  return payload.data.map(catalogTrackToSong);
}

export async function fetchAlbumCollection(albumId: number): Promise<CatalogCollection> {
  const album = await fetchJson<DeezerAlbumResponse>(`/album/${albumId}`);
  const tracks = (album.tracks?.data ?? []).map((track) =>
    catalogTrackToSong({
      ...track,
      album: {
        id: album.id,
        title: album.title,
        cover_medium: album.cover_medium,
        cover_xl: album.cover_xl,
      },
      artist: track.artist ?? album.artist ?? { name: 'Unknown artist' },
    }),
  );
  return {
    id: album.id ?? albumId,
    title: album.title,
    subtitle: album.artist?.name ?? 'Album',
    artwork: artwork(album.cover_xl, album.cover_medium),
    tracks,
  };
}

export async function fetchArtistCollection(artistId: number): Promise<CatalogCollection> {
  const [artist, top] = await Promise.all([
    fetchJson<DeezerArtistResponse>(`/artist/${artistId}`),
    fetchJson<DeezerList<DeezerTrack>>(`/artist/${artistId}/top?limit=50`),
  ]);
  return {
    id: artist.id ?? artistId,
    title: artist.name,
    subtitle: artist.nb_fan ? `${artist.nb_fan.toLocaleString()} fans` : 'Artist',
    artwork: artwork(artist.picture_xl, artist.picture_medium),
    tracks: top.data.map(catalogTrackToSong),
  };
}
