import type { LyricsQuery } from '@/src/services/lyrics/query';
import type { TrackLyrics } from '@/src/services/lyrics/types';
import { parseLrc, parseUnsyncedLyrics } from '@/src/utils/lrc';

type LrcLibRecord = {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

const API = 'https://lrclib.net/api';
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'VibX/2.0 (offline music player)',
};
const TIMEOUT_MS = 8000;
const DURATION_WINDOW = 6;

function compact(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/ñ/g, 'n')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function compactKey(value: string): string {
  return compact(value).replace(/\s+/g, '');
}

function foldTitle(value: string): string {
  return compactKey(
    value
      .replace(/\bskate\s*avenn?ue(?:\s*ph)?\b/gi, ' ')
      .replace(/\b(?:(?:punk|ai|opm)\s+)?(?:rock\s+)?(?:cover|version|ver)\b/gi, ' '),
  );
}

function similarName(left: string, right: string): boolean {
  const a = compact(left);
  const b = compact(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const ak = foldTitle(left);
  const bk = foldTitle(right);
  if (!ak || !bk) return false;
  if (ak === bk) return true;
  const [shorter, longer] = ak.length <= bk.length ? [ak, bk] : [bk, ak];
  if (shorter.length < 10 || !longer.startsWith(shorter)) return false;
  return longer.length - shorter.length <= 4;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function searchUrl(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    query.set(key, String(value));
  }
  return `${API}${path}?${query.toString()}`;
}

function recordToLyrics(record: LrcLibRecord, duration = 0): TrackLyrics | null {
  if (record.instrumental) return null;
  const synced = record.syncedLyrics ? parseLrc(record.syncedLyrics) : [];
  if (synced.length > 0) {
    return {
      lines: synced,
      synced: true,
      source: 'lrclib',
      raw: record.syncedLyrics ?? undefined,
    };
  }
  if (record.plainLyrics) {
    const unsynced = parseUnsyncedLyrics(record.plainLyrics, duration);
    if (unsynced.length > 0) {
      return { lines: unsynced, synced: false, source: 'lrclib', raw: record.plainLyrics };
    }
  }
  return null;
}

function durationClose(record: LrcLibRecord, duration: number, window = DURATION_WINDOW): boolean {
  if (duration <= 1 || !record.duration || record.duration <= 0) return true;
  return Math.abs(record.duration - duration) <= window;
}

function scoreRecord(record: LrcLibRecord, query: LyricsQuery, duration: number): number {
  if (record.instrumental) return -1000;
  const synced = record.syncedLyrics ? parseLrc(record.syncedLyrics) : [];
  const hasPlain = Boolean(record.plainLyrics?.trim());
  if (synced.length < 2 && !hasPlain) return -1000;

  const titleHit = similarName(record.trackName ?? '', query.title);
  const artistHit = Boolean(query.artist) && similarName(record.artistName ?? '', query.artist);
  let score = synced.length >= 2 ? 80 : 12;

  if (query.original) {
    if (!titleHit) return -1000;
    if (query.artist && !artistHit) return -1000;
    if (titleHit) score += 36;
    if (artistHit) score += 55;
    if (titleHit && artistHit) score += 20;
    if (artistHit && duration > 1 && record.duration && record.duration > 0) {
      const diff = Math.abs(record.duration - duration);
      if (diff <= 12) score += 8;
      else if (diff <= 45) score += 2;
    }
    return score;
  }

  if (duration > 1 && record.duration && record.duration > 0) {
    const diff = Math.abs(record.duration - duration);
    if (titleHit) {
      if (diff <= 2) score += 50;
      else if (diff <= 8) score += 28;
      else if (diff <= 20) score += 10;
      else score -= Math.min(24, Math.round((diff - 20) / 2));
    } else if (diff <= 1) score += 70;
    else if (diff <= 2) score += 55;
    else if (diff <= DURATION_WINDOW) score += 30;
    else score -= Math.min(80, Math.round(diff * 8));
  }

  if (titleHit) score += 36;
  if (artistHit) score += 30;
  if (titleHit && artistHit) score += 20;
  if (query.album && similarName(record.albumName ?? '', query.album)) score += 8;
  return score;
}

function pickBest(records: LrcLibRecord[], query: LyricsQuery, duration: number): LrcLibRecord | null {
  let best: LrcLibRecord | null = null;
  let bestScore = query.original ? 40 : 28;
  for (const record of records) {
    const titleHit = similarName(record.trackName ?? '', query.title);
    const artistHit = Boolean(query.artist) && similarName(record.artistName ?? '', query.artist);
    if (query.original && !titleHit) continue;
    if (query.original && query.artist && !artistHit) continue;
    const window = titleHit && artistHit ? 28 : titleHit ? 24 : DURATION_WINDOW;
    if (!query.original && !titleHit && !durationClose(record, duration, window) && duration > 1) continue;
    const score = scoreRecord(record, query, duration);
    if (score > bestScore) {
      best = record;
      bestScore = score;
    }
  }
  return best;
}

async function getExact(query: LyricsQuery, duration: number): Promise<LrcLibRecord | null> {
  if (!query.artist) return null;
  const attempts: Array<Record<string, string | number | undefined>> = [
    {
      track_name: query.title,
      artist_name: query.artist,
      album_name: query.album,
      duration: query.original ? undefined : duration > 1 ? Math.round(duration) : undefined,
    },
  ];
  if (query.album || duration > 1) {
    attempts.push({
      track_name: query.title,
      artist_name: query.artist,
    });
  }

  for (const params of attempts) {
    const record = await fetchJson<LrcLibRecord>(searchUrl('/get', params));
    if (!record) continue;
    const titleHit = similarName(record.trackName ?? '', query.title);
    if (titleHit || durationClose(record, duration, titleHit ? 28 : DURATION_WINDOW)) return record;
  }
  return null;
}

function mergeRecords(groups: LrcLibRecord[][]): LrcLibRecord[] {
  const records: LrcLibRecord[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const record of group) {
      const key = String(record.id ?? `${record.trackName}|${record.artistName}|${record.duration}`);
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(record);
    }
  }
  return records;
}

async function searchRecords(query: LyricsQuery, loose = false): Promise<LrcLibRecord[]> {
  if (loose) {
    const keyword = [query.artist, query.title].filter(Boolean).join(' ');
    if (!keyword) return [];
    return (await fetchJson<LrcLibRecord[]>(searchUrl('/search', { q: keyword }))) ?? [];
  }

  return (
    (await fetchJson<LrcLibRecord[]>(
      searchUrl('/search', {
        track_name: query.title,
        artist_name: query.artist || undefined,
      }),
    )) ?? []
  );
}

export async function fetchRemoteSyncedLyrics(
  queries: LyricsQuery[],
  duration: number,
): Promise<TrackLyrics | null> {
  let sawResponse = false;
  let lastError: unknown;
  let bestPlain: TrackLyrics | null = null;

  const limited = queries.slice(0, 8);
  for (const query of limited) {
    try {
      const exact = await getExact(query, duration);
      sawResponse = true;
      if (exact) {
        const lyrics = recordToLyrics(exact, duration);
        if (lyrics?.synced) return lyrics;
        if (lyrics && !bestPlain) bestPlain = lyrics;
      }

      let matches = await searchRecords(query);
      sawResponse = true;
      let best = pickBest(matches, query, duration);
      if (!best) {
        const loose = await searchRecords(query, true);
        best = pickBest(mergeRecords([matches, loose]), query, duration);
      }
      if (best) {
        const lyrics = recordToLyrics(best, duration);
        if (lyrics?.synced) return lyrics;
        if (lyrics && !bestPlain) bestPlain = lyrics;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (bestPlain) return bestPlain;
  if (!sawResponse && lastError) throw lastError;
  return null;
}
