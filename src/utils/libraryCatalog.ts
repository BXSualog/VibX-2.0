import type { Song } from '@/src/types/music';
import { normalizeTrackLabels, type TrackMetadata } from '@/src/utils/metadata';
import { lettersKey } from '@/src/utils/sort';
import { dedupeSongs } from '@/src/utils/songIdentity';

export type LabeledSong = {
  song: Song;
  title: string;
  artist: string;
  letter: string;
  letters: string;
};

export type LibraryCatalog = {
  songs: Song[];
  labeled: LabeledSong[];
  labelsById: Map<string, TrackMetadata>;
  azSongs: Song[];
  recentSongs: Song[];
};

let cache: LibraryCatalog | null = null;

function canReuseCatalog(prev: Song[], next: Song[]) {
  if (prev.length !== next.length) return false;
  for (let index = 0; index < prev.length; index += 1) {
    const left = prev[index];
    const right = next[index];
    if (
      left.id !== right.id ||
      left.title !== right.title ||
      left.artist !== right.artist ||
      left.album !== right.album ||
      left.artwork !== right.artwork ||
      left.createdAt !== right.createdAt
    ) {
      return false;
    }
  }
  return true;
}

function reuseCatalog(songs: Song[], current: LibraryCatalog): LibraryCatalog {
  const byId = new Map(songs.map((song) => [song.id, song]));
  const labeled = current.labeled.map((item) => ({
    ...item,
    song: byId.get(item.song.id) ?? item.song,
  }));
  const azSongs = current.azSongs.map((song) => byId.get(song.id) ?? song);
  const recentSongs = current.recentSongs.map((song) => byId.get(song.id) ?? song);
  const next = { songs, labeled, labelsById: current.labelsById, azSongs, recentSongs };
  cache = next;
  return next;
}

function compareLabeled(a: LabeledSong, b: LabeledSong) {
  if (a.letters && b.letters) {
    const byLetters = a.letters.localeCompare(b.letters, undefined, { sensitivity: 'base' });
    if (byLetters !== 0) return byLetters;
  } else if (a.letters) {
    return -1;
  } else if (b.letters) {
    return 1;
  }
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

export function getLibraryCatalog(songs: Song[]): LibraryCatalog {
  const unique = dedupeSongs(songs);
  if (cache && cache.songs === unique) return cache;
  if (cache && canReuseCatalog(cache.songs, unique)) return reuseCatalog(unique, cache);

  const labeled: LabeledSong[] = new Array(unique.length);
  const labelsById = new Map<string, TrackMetadata>();

  for (let index = 0; index < unique.length; index += 1) {
    const song = unique[index];
    const labels = normalizeTrackLabels(song.title, song.artist);
    const letters = lettersKey(labels.title);
    labeled[index] = {
      song,
      title: labels.title,
      artist: labels.artist,
      letter: letters ? letters[0].toLocaleUpperCase() : '#',
      letters,
    };
    labelsById.set(song.id, labels);
  }

  const azSongs = [...labeled].sort(compareLabeled).map((item) => item.song);
  const recentSongs = [...unique].sort((a, b) => b.createdAt - a.createdAt);

  cache = { songs: unique, labeled, labelsById, azSongs, recentSongs };
  return cache;
}

export function warmupLibraryCatalog(songs: Song[]) {
  if (songs.length === 0) return;
  getLibraryCatalog(songs);
}
