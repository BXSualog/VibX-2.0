import type { LyricsQuery } from '@/src/services/lyrics/query';
import { isCoverProject } from '@/src/services/lyrics/query';
import {
  isCoverChannel,
  isKnownFilipinoArtist,
  looksFilipinoTitle,
} from '@/src/services/lyrics/coverOriginals';
import type { TrackLyrics } from '@/src/services/lyrics/types';
import { parseUnsyncedLyrics } from '@/src/utils/lrc';

type ItunesSong = {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  trackTimeMillis?: number;
  primaryGenreName?: string;
};

type ItunesSearch = {
  results?: ItunesSong[];
};

const UNLIKELY_ORIGINAL =
  /metal|punk|edm|electro|house|techno|trance|hip-?hop|rap|death|industrial|hardcore|black metal/i;

type DeezerSearchTrack = {
  title?: string;
  title_short?: string;
  rank?: number;
  artist?: { name?: string };
  album?: { title?: string };
};

type DeezerSearch = {
  data?: DeezerSearchTrack[];
};

const TIMEOUT_MS = 7000;

function useful(value?: string): boolean {
  const text = value?.trim() ?? '';
  return text.length > 1 && !/^unknown( artist| title)?$/i.test(text);
}

function compactKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function similar(left: string, right: string): boolean {
  const a = compactKey(
    left
      .replace(/\bskate\s*avenn?ue(?:\s*ph)?\b/gi, ' ')
      .replace(/\b(?:(?:punk|ai|opm)\s+)?(?:rock\s+)?(?:cover|version|ver)\b/gi, ' '),
  );
  const b = compactKey(
    right
      .replace(/\bskate\s*avenn?ue(?:\s*ph)?\b/gi, ' ')
      .replace(/\b(?:(?:punk|ai|opm)\s+)?(?:rock\s+)?(?:cover|version|ver)\b/gi, ' '),
  );
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 10 && longer.startsWith(shorter) && longer.length - shorter.length <= 4;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function searchUrl(term: string, country: string): string {
  const query = new URLSearchParams({
    term,
    entity: 'song',
    limit: '8',
    country,
  });
  return `https://itunes.apple.com/search?${query.toString()}`;
}

function scoreHit(hit: ItunesSong, query: LyricsQuery, index = 0): number {
  const title = hit.trackName ?? '';
  const artist = hit.artistName ?? '';
  if (!useful(title)) return -1;
  if (!similar(title, query.title)) return -1;
  if (isCoverProject(artist) || isCoverChannel(artist) || isCoverChannel(hit.collectionName)) return -1;

  let score = 40;
  if (query.artist && similar(artist, query.artist)) score += 40;
  if (query.original && similar(title, query.title)) score += 20;
  if (query.original && looksFilipinoTitle(query.title) && isKnownFilipinoArtist(artist)) score += 50;
  if (query.original && looksFilipinoTitle(query.title) && !isKnownFilipinoArtist(artist)) score -= 8;
  if (UNLIKELY_ORIGINAL.test(hit.primaryGenreName ?? '')) score -= 40;
  if (/pop|r&b|soul|vocal|soundtrack|adult|country|world/i.test(hit.primaryGenreName ?? '')) score += 10;
  if (/instrumental/i.test(hit.primaryGenreName ?? '') || /instrumental/i.test(title)) score -= 30;
  if (query.album && hit.collectionName && similar(hit.collectionName, query.album)) score += 6;
  score += Math.max(0, 8 - index);
  return score;
}

function toQuery(hit: ItunesSong, original = false): LyricsQuery {
  return {
    title: hit.trackName?.trim() ?? '',
    artist: hit.artistName?.trim() ?? '',
    album: useful(hit.collectionName) ? hit.collectionName!.trim() : undefined,
    original,
  };
}

async function searchCountry(query: LyricsQuery, country: string): Promise<ItunesSong[]> {
  const term = [query.artist, query.title].filter(Boolean).join(' ').trim();
  if (!term) return [];
  const data = await fetchJson<ItunesSearch>(searchUrl(term, country));
  return data?.results ?? [];
}

export async function catalogQueriesForSong(queries: LyricsQuery[]): Promise<LyricsQuery[]> {
  const extra: LyricsQuery[] = [];
  const seen = new Set<string>();
  const seeds = queries.slice(0, 3);

  for (const seed of seeds) {
    const countries = seed.original ? ['us', 'ph'] : ['ph', 'us'];
    const hits = (
      await Promise.all(countries.map((country) => searchCountry(seed, country)))
    ).flat();
    if (hits.length === 0) continue;
    const ranked = hits
      .map((hit, index) => ({ hit, score: scoreHit(hit, seed, index), index }))
      .filter((entry) => entry.score >= 30)
      .sort((left, right) => right.score - left.score || left.index - right.index);

    for (const entry of ranked.slice(0, 2)) {
      const next = toQuery(entry.hit, seed.original);
      if (!useful(next.title) || isCoverProject(next.artist) || isCoverProject(next.title)) continue;
      const key = `${next.title}|${next.artist}`.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      extra.push(next);
    }
    if (extra.length >= 4) break;
  }

  return extra;
}

function pushOriginal(list: LyricsQuery[], seen: Set<string>, next: LyricsQuery) {
  if (!useful(next.title) || !useful(next.artist)) return;
  if (isCoverProject(next.artist) || isCoverProject(next.title) || isCoverChannel(next.artist)) return;
  const key = `${next.title}|${next.artist}`.toLocaleLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  list.push({ title: next.title, artist: next.artist, original: true });
}

export async function resolveCoverOriginals(title: string): Promise<LyricsQuery[]> {
  const cleaned = title.trim();
  if (!cleaned) return [];

  const extra: LyricsQuery[] = [];
  const seen = new Set<string>();

  const seed: LyricsQuery = { title: cleaned, artist: '', original: true };
  const countries = looksFilipinoTitle(cleaned) ? ['ph', 'us'] : ['us', 'ph'];
  const itunesHits = (await Promise.all(countries.map((country) => searchCountry(seed, country)))).flat();
  const deezer =
    (
      await fetchJson<DeezerSearch>(
        `https://api.deezer.com/search?q=${encodeURIComponent(`track:"${cleaned}"`)}&limit=8`,
      )
    )?.data ?? [];

  const ranked = [
    ...itunesHits.map((hit, index) => ({
      artist: hit.artistName?.trim() ?? '',
      score: scoreHit(hit, seed, index),
    })),
    ...deezer.map((hit, index) => {
      const artist = hit.artist?.name?.trim() ?? '';
      const track = (hit.title_short || hit.title || '').trim();
      const fake: ItunesSong = {
        trackName: track,
        artistName: artist,
        collectionName: hit.album?.title,
      };
      let score = scoreHit(fake, seed, index);
      if (score > 0) score += Math.min(16, Math.round(Math.log10((hit.rank ?? 1) + 1)));
      return { artist, score };
    }),
  ]
    .filter((entry) => entry.score >= 40 && useful(entry.artist))
    .sort((left, right) => right.score - left.score);

  for (const entry of ranked.slice(0, 3)) {
    pushOriginal(extra, seen, { title: cleaned, artist: entry.artist, original: true });
  }
  return extra;
}

export async function fetchPlainRemoteLyrics(
  queries: LyricsQuery[],
  duration = 0,
): Promise<TrackLyrics | null> {
  for (const query of queries.slice(0, 6)) {
    if (!query.artist || !query.title) continue;
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(query.artist)}/${encodeURIComponent(query.title)}`;
    try {
      const data = await fetchJson<{ lyrics?: string }>(url);
      const text = data?.lyrics?.trim();
      if (!text) continue;
      const lines = parseUnsyncedLyrics(text, duration);
      if (lines.length < 4) continue;
      return { lines, synced: false, source: 'lyricsovh', raw: text };
    } catch {
      // Keep trying other title/artist spellings.
    }
  }
  return null;
}
