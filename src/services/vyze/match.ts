import Fuse from 'fuse.js';
import type { Song, VyzeIntent } from '@/src/types/music';

export type PlayMatch =
  | { kind: 'none'; query: string }
  | { kind: 'single'; song: Song }
  | { kind: 'many'; songs: Song[]; query: string };

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsQuery(haystack: string, query: string): boolean {
  const text = normalize(haystack);
  const needle = normalize(query);
  if (!text || !needle) return false;
  return text.includes(needle);
}

function scoreSong(song: Song, query: string): number {
  const needle = normalize(query);
  const title = normalize(song.title);
  const artist = normalize(song.artist);
  const album = normalize(song.album);
  const combined = `${title} ${artist}`;
  let score = 0;
  if (title === needle || artist === needle || combined === needle) score += 8;
  if (containsQuery(song.artist, query)) score += 5;
  if (containsQuery(song.title, query)) score += 4;
  if (containsQuery(song.album, query)) score += 2;
  if (containsQuery(`${song.title} ${song.artist}`, query)) score += 3;
  return score;
}

function fuseMatches(query: string, songs: Song[], keys: { name: keyof Song; weight: number }[], threshold: number) {
  const fuse = new Fuse(songs, {
    keys,
    threshold,
    ignoreLocation: true,
    includeScore: true,
  });
  return fuse.search(query).map((result) => result.item);
}

export function fuzzyMatchSong(query: string, songs: Song[]): Song | null {
  const match = resolvePlayRequest({ action: 'play', query }, songs);
  if (match.kind === 'single') return match.song;
  if (match.kind === 'many') return match.songs[0] ?? null;
  return null;
}

export function resolvePlayRequest(intent: Extract<VyzeIntent, { action: 'play' }>, songs: Song[]): PlayMatch {
  const query = intent.query.trim();
  if (!query || songs.length === 0) return { kind: 'none', query };

  if (intent.title && intent.artist) {
    const titleHits = fuseMatches(intent.title, songs, [{ name: 'title', weight: 1 }], 0.4);
    const artistHits = new Set(
      fuseMatches(intent.artist, songs, [{ name: 'artist', weight: 1 }], 0.4).map((song) => song.id)
    );
    const both = titleHits.filter((song) => artistHits.has(song.id));
    const ranked = (both.length > 0 ? both : titleHits)
      .map((song) => ({ song, score: scoreSong(song, `${intent.title} ${intent.artist}`) }))
      .sort((left, right) => right.score - left.score);
    const best = ranked[0]?.song;
    if (!best) return { kind: 'none', query: `${intent.title} by ${intent.artist}` };
    return { kind: 'single', song: best };
  }

  const textHits = songs.filter(
    (song) =>
      containsQuery(song.title, query) ||
      containsQuery(song.artist, query) ||
      containsQuery(song.album, query) ||
      containsQuery(`${song.title} ${song.artist}`, query)
  );

  const fuzzyHits = fuseMatches(
    query,
    songs,
    [
      { name: 'title', weight: 0.45 },
      { name: 'artist', weight: 0.45 },
      { name: 'album', weight: 0.1 },
    ],
    0.38
  );

  const seen = new Set<string>();
  const matches: Song[] = [];
  for (const song of [...textHits, ...fuzzyHits]) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    matches.push(song);
  }

  if (matches.length === 0) return { kind: 'none', query };
  if (matches.length === 1) return { kind: 'single', song: matches[0] };

  const ranked = matches
    .map((song) => ({ song, score: scoreSong(song, query) }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.song);

  return { kind: 'many', songs: ranked, query };
}
