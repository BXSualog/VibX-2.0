import type { Playlist, Song } from '@/src/types/music';
import { MIN_ARTIST_ALBUM_SONGS, type ArtistAlbum } from '@/src/utils/artistAlbums';

export type NamedAlbum = {
  album: string;
  artist: string;
  artwork: string | null;
  songs: Song[];
};

export type SearchCatalog = {
  songs: Song[];
  namedAlbums: NamedAlbum[];
  artistAlbums: ArtistAlbum[];
  playlists: Playlist[];
};

const SONG_LIMIT = 30;
const ALBUM_LIMIT = 16;
const PLAYLIST_LIMIT = 16;

let cache: { songs: Song[]; playlists: Playlist[]; catalog: SearchCatalog } | null = null;

function includesQuery(value: string, query: string): boolean {
  return value.toLowerCase().includes(query);
}

export function getSearchCatalog(songs: Song[], playlists: Playlist[]): SearchCatalog {
  if (cache && cache.songs === songs && cache.playlists === playlists) return cache.catalog;

  const named = new Map<string, NamedAlbum>();
  const artists = new Map<string, ArtistAlbum>();

  for (const song of songs) {
    const albumName = song.album.trim();
    const artistName = song.artist.trim();

    if (albumName && !/^unknown album$/i.test(albumName)) {
      const key = `${albumName.toLowerCase()}::${artistName.toLowerCase()}`;
      const current = named.get(key);
      if (current) {
        current.songs.push(song);
        if (!current.artwork && song.artwork) current.artwork = song.artwork;
      } else {
        named.set(key, {
          album: albumName,
          artist: artistName || 'Unknown artist',
          artwork: song.artwork,
          songs: [song],
        });
      }
    }

    if (artistName && !/^unknown artist$/i.test(artistName)) {
      const key = artistName.toLowerCase();
      const current = artists.get(key);
      if (current) {
        current.songs.push(song);
        current.duration += song.duration || 0;
        if (!current.artwork && song.artwork) current.artwork = song.artwork;
      } else {
        artists.set(key, {
          artist: artistName,
          songs: [song],
          artwork: song.artwork,
          duration: song.duration || 0,
        });
      }
    }
  }

  const catalog: SearchCatalog = {
    songs,
    namedAlbums: [...named.values()],
    artistAlbums: [...artists.values()].filter((album) => album.songs.length >= MIN_ARTIST_ALBUM_SONGS),
    playlists,
  };
  cache = { songs, playlists, catalog };
  return catalog;
}

export function searchSongs(songs: Song[], query: string): Song[] {
  const matches: Song[] = [];
  for (const song of songs) {
    if (
      includesQuery(song.title, query) ||
      includesQuery(song.artist, query) ||
      includesQuery(song.album, query)
    ) {
      matches.push(song);
      if (matches.length >= SONG_LIMIT) break;
    }
  }
  return matches;
}

export function searchNamedAlbums(albums: NamedAlbum[], query: string): NamedAlbum[] {
  const matches: NamedAlbum[] = [];
  for (const album of albums) {
    if (includesQuery(album.album, query) || includesQuery(album.artist, query)) {
      matches.push(album);
      if (matches.length >= ALBUM_LIMIT) break;
    }
  }
  return matches;
}

export function searchArtistAlbums(albums: ArtistAlbum[], query: string): ArtistAlbum[] {
  const matches: ArtistAlbum[] = [];
  for (const album of albums) {
    if (includesQuery(album.artist, query)) {
      matches.push(album);
      if (matches.length >= ALBUM_LIMIT) break;
    }
  }
  return matches;
}

export function searchPlaylists(playlists: Playlist[], query: string): Playlist[] {
  const matches: Playlist[] = [];
  for (const playlist of playlists) {
    if (includesQuery(playlist.name, query)) {
      matches.push(playlist);
      if (matches.length >= PLAYLIST_LIMIT) break;
    }
  }
  return matches;
}
