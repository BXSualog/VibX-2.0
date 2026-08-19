import type { Song } from '@/src/types/music';
import { artistGroupKey } from '@/src/utils/knownArtists';
import { normalizeTrackLabels } from '@/src/utils/metadata';
import { lettersKey } from '@/src/utils/sort';

const GENERIC_FILE = /^(imported|audio|track|song)[-_\s]?\d+\.(mp3|m4a|aac|wav|flac|ogg|wma|aiff)$/i;

export function songFileKey(song: Pick<Song, 'localPath'> | string): string | null {
  const path = typeof song === 'string' ? song : song.localPath;
  const name = (path.split(/[/\\]/).pop() ?? '').trim().toLowerCase();
  if (!name || GENERIC_FILE.test(name)) return null;
  return name;
}

export function songIdentityKey(song: Pick<Song, 'title' | 'artist'>): string | null {
  const labels = normalizeTrackLabels(song.title, song.artist);
  const title = lettersKey(labels.title).toLocaleLowerCase() || labels.title.trim().toLocaleLowerCase();
  const artist = artistGroupKey(labels.artist);
  if (!title || title === 'unknown' || title === 'unknowntitle') return null;
  return `${artist}\u0000${title}`;
}

export function preferSong(a: Song, b: Song): Song {
  const score = (song: Song) =>
    (song.isDownloaded ? 16 : 0) +
    (song.artwork ? 8 : 0) +
    (song.duration > 0 ? 4 : 0) +
    (song.album && !/^(imported|on this device|unknown album)$/i.test(song.album) ? 2 : 0);

  const left = score(a);
  const right = score(b);
  if (left !== right) return left >= right ? a : b;
  return a.createdAt <= b.createdAt ? a : b;
}

function parentOf(parent: Map<string, string>, id: string): string {
  let current = parent.get(id) ?? id;
  while (parent.get(current) && parent.get(current) !== current) {
    const next = parent.get(current) ?? current;
    parent.set(current, parent.get(next) ?? next);
    current = next;
  }
  parent.set(id, current);
  return current;
}

function union(parent: Map<string, string>, left: string, right: string) {
  const a = parentOf(parent, left);
  const b = parentOf(parent, right);
  if (a !== b) parent.set(a, b);
}

export function duplicateGroups(songs: Song[]): Song[][] {
  const byId = new Map(songs.map((song) => [song.id, song]));
  const parent = new Map<string, string>();
  const identityGroups = new Map<string, string>();
  const fileGroups = new Map<string, string>();

  for (const song of songs) {
    parent.set(song.id, song.id);
    const identity = songIdentityKey(song);
    if (identity) {
      const seen = identityGroups.get(identity);
      if (seen) union(parent, seen, song.id);
      else identityGroups.set(identity, song.id);
    }
    const file = songFileKey(song);
    if (file) {
      const seen = fileGroups.get(file);
      if (seen) union(parent, seen, song.id);
      else fileGroups.set(file, song.id);
    }
  }

  const groups = new Map<string, Song[]>();
  for (const song of songs) {
    const root = parentOf(parent, song.id);
    const list = groups.get(root);
    if (list) list.push(song);
    else groups.set(root, [byId.get(song.id) ?? song]);
  }

  return [...groups.values()].filter((group) => group.length > 1);
}

export function dedupeSongs(songs: Song[]): Song[] {
  if (songs.length < 2) return songs;

  const keep = new Map<string, Song>();
  const drop = new Set<string>();

  for (const group of duplicateGroups(songs)) {
    const winner = group.reduce(preferSong);
    keep.set(winner.id, winner);
    for (const song of group) {
      if (song.id !== winner.id) drop.add(song.id);
    }
  }

  if (drop.size === 0) return songs;
  return songs.filter((song) => !drop.has(song.id));
}
