import type { Song } from '@/src/types/music';
import {
  artistGroupKey,
  buildArtistCanonicalMap,
  clusteredArtistName,
} from '@/src/utils/knownArtists';
import { normalizeTrackLabels } from '@/src/utils/metadata';
import { compareText } from '@/src/utils/sort';

export const MIN_ARTIST_ALBUM_SONGS = 3;

export type ArtistAlbum = {
  artist: string;
  songs: Song[];
  artwork: string | null;
  duration: number;
};

export function artistAlbumsFromSongs(songs: Song[], minSongs = MIN_ARTIST_ALBUM_SONGS): ArtistAlbum[] {
  const prepared: { song: Song; artist: string }[] = [];

  for (const song of songs) {
    const artist = normalizeTrackLabels(song.title, song.artist).artist.trim();
    if (!artist || /^unknown artist$/i.test(artist)) continue;
    prepared.push({ song, artist });
  }

  const canonicalMap = buildArtistCanonicalMap(prepared.map((item) => item.artist));
  const groups = new Map<string, ArtistAlbum>();

  for (const { song, artist } of prepared) {
    const display = clusteredArtistName(artist, canonicalMap);
    const key = artistGroupKey(display);
    const current = groups.get(key);
    if (current) {
      current.songs.push(song);
      current.duration += song.duration || 0;
      if (!current.artwork && song.artwork) current.artwork = song.artwork;
    } else {
      groups.set(key, {
        artist: display,
        songs: [song],
        artwork: song.artwork,
        duration: song.duration || 0,
      });
    }
  }

  return [...groups.values()]
    .filter((group) => group.songs.length >= minSongs)
    .map((group) => ({
      ...group,
      songs: [...group.songs].sort((a, b) =>
        compareText(
          normalizeTrackLabels(a.title, a.artist).title,
          normalizeTrackLabels(b.title, b.artist).title
        )
      ),
    }))
    .sort((a, b) => b.songs.length - a.songs.length || compareText(a.artist, b.artist));
}

export function artistAlbumForSongs(allSongs: Song[], songIds: Iterable<string>): ArtistAlbum | null {
  const wanted = new Set(songIds);
  if (wanted.size === 0) return null;

  const matches = artistAlbumsFromSongs(allSongs).filter((album) =>
    album.songs.some((song) => wanted.has(song.id))
  );
  if (matches.length !== 1) return null;

  const album = matches[0];
  for (const id of wanted) {
    if (!album.songs.some((song) => song.id === id)) return null;
  }
  return album;
}
