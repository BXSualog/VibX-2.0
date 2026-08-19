import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { getVibxDirectory } from '@/src/services/downloads/libraryDir';
import { catalogQueriesForSong, fetchPlainRemoteLyrics, resolveCoverOriginals } from '@/src/services/lyrics/catalog';
import { fetchRemoteSyncedLyrics } from '@/src/services/lyrics/lrclib';
import { isCoverProject, lyricsQueriesForSong } from '@/src/services/lyrics/query';
import type { TrackLyrics } from '@/src/services/lyrics/types';
import { readId3Lyrics } from '@/src/utils/id3';
import { parseLrc, parseUnsyncedLyrics, prepareLyricLines } from '@/src/utils/lrc';
import { decodeDisplayName, sanitizeFilename } from '@/src/utils/metadata';
import type { Song } from '@/src/types/music';

export type { TrackLyrics } from '@/src/services/lyrics/types';

const cache = new Map<string, TrackLyrics | null>();
const inflight = new Map<string, Promise<TrackLyrics | null>>();

const LOOKUP_DIRS = [
  '/storage/emulated/0/Download',
  '/storage/emulated/0/Downloads',
  '/storage/emulated/0/Music',
  '/sdcard/Download',
  '/sdcard/Music',
];

function stripQuery(path: string): string {
  const index = path.indexOf('?');
  return index >= 0 ? path.slice(0, index) : path;
}

function basename(path: string): string {
  return decodeDisplayName(stripQuery(path).split(/[/\\]/).pop() ?? '');
}

function replaceExt(path: string, ext: string): string {
  return stripQuery(path).replace(/\.[^./\\]+$/, '') + ext;
}

function stem(name: string): string {
  return name.replace(/\.[^./\\]+$/, '');
}

function looksLikePlainLyrics(text: string): boolean {
  const parts = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (parts.length < 3 || parts.length > 250) return false;
  const average = parts.reduce((sum, line) => sum + line.length, 0) / parts.length;
  return average > 0 && average <= 90;
}

async function readTextUri(uri: string): Promise<string | null> {
  try {
    const file = new File(uri);
    if (file.exists) {
      const text = await file.text();
      return text?.trim() ? text : null;
    }
    if (uri.startsWith('file:') || uri.startsWith('/')) return null;
  } catch {
    // Content URIs fall through to the legacy reader.
  }
  try {
    const text = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return text?.trim() ? text : null;
  } catch {
    return null;
  }
}

function candidateUris(song: Song): string[] {
  const uris: string[] = [];
  const seen = new Set<string>();
  const push = (uri?: string) => {
    if (!uri) return;
    const key = uri.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    uris.push(uri);
  };

  const fileName = basename(song.localPath);
  const names = new Set<string>();
  if (fileName) names.add(stem(fileName));
  const titled = sanitizeFilename(song.title);
  if (titled) names.add(stem(titled));

  push(replaceExt(song.localPath, '.lrc'));
  push(replaceExt(song.localPath, '.txt'));

  const dirs = [getVibxDirectory().uri.replace(/\/$/, ''), ...LOOKUP_DIRS, ...LOOKUP_DIRS.map((path) => `file://${path}`)];
  for (const dir of dirs) {
    for (const name of names) {
      push(`${dir}/${name}.lrc`);
      push(`${dir}/${name}.txt`);
    }
  }

  return uris;
}

function linesFromText(text: string, duration: number, allowPlain: boolean): TrackLyrics | null {
  const synced = parseLrc(text);
  if (synced.length > 0) return { lines: synced, synced: true, source: 'local', raw: text };
  if (!allowPlain && !looksLikePlainLyrics(text)) return null;
  const unsynced = parseUnsyncedLyrics(text, duration);
  if (unsynced.length === 0) return null;
  return {
    lines: unsynced,
    synced: unsynced.some((line, index) => index > 0 && line.time > 0),
    source: 'local',
    raw: text,
  };
}

async function readSidecarLyrics(song: Song): Promise<TrackLyrics | null> {
  for (const uri of candidateUris(song)) {
    const text = await readTextUri(uri);
    if (!text) continue;
    const allowPlain = /\.lrc$/i.test(uri) || looksLikePlainLyrics(text);
    const lyrics = linesFromText(text, song.duration, allowPlain);
    if (lyrics) return lyrics;
  }
  return null;
}

async function readEmbeddedLyrics(song: Song): Promise<TrackLyrics | null> {
  try {
    const tags = await readId3Lyrics(song.localPath);
    if (!tags) return null;
    if (tags.synced && tags.synced.length > 0) {
      return { lines: prepareLyricLines(tags.synced), synced: true, source: 'id3' };
    }
    if (tags.unsynced) {
      return linesFromText(tags.unsynced, song.duration, true);
    }
  } catch {
    // Unreadable files keep the default artwork.
  }
  return null;
}

async function saveLibraryLrc(song: Song, raw: string): Promise<void> {
  const fileName = basename(song.localPath);
  const name = `${stem(fileName || sanitizeFilename(song.title) || `track-${song.id}`)}.lrc`;
  const dest = new File(getVibxDirectory(), name);
  try {
    if (!dest.exists) dest.create();
    dest.write(raw);
  } catch {
    try {
      await FileSystem.writeAsStringAsync(dest.uri, raw, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch {
      // Playback still works from memory if the sidecar cannot be written.
    }
  }
}

export async function loadTrackLyrics(
  song: Song,
  duration = 0,
  options?: { deep?: boolean },
): Promise<TrackLyrics | null> {
  const seconds = duration > 1 ? duration : song.duration;
  const deep = options?.deep !== false;
  const key = `${song.id}:${Math.round(seconds || 0)}:i18n:coverorig2:${deep ? 'deep' : 'fast'}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    const cover =
      isCoverProject(song.artist) ||
      isCoverProject(song.title) ||
      isCoverProject(basename(song.localPath));
    const ownOriginal =
      cover &&
      /\boriginal songs?\b/i.test(`${song.title} ${song.album} ${basename(song.localPath)}`);
    const local = (await readSidecarLyrics(song)) ?? (await readEmbeddedLyrics(song));
    if ((local?.synced && !cover) || ownOriginal) {
      cache.set(key, local);
      return local;
    }

    try {
      const queries = lyricsQueriesForSong(song);
      const withArtist = queries.filter((query) => query.artist);
      const coverTitle = withArtist[0]?.title || queries[0]?.title || song.title;
      let remote: TrackLyrics | null = null;

      if (cover) {
        let lookup = withArtist;
        let resolvedCatalog = false;
        if (lookup.length === 0 && deep) {
          lookup = await resolveCoverOriginals(coverTitle);
          resolvedCatalog = true;
        }
        if (lookup.length > 0) {
          remote = await fetchRemoteSyncedLyrics(lookup, seconds);
        }
        if (!remote?.lines.length && deep) {
          const extra = resolvedCatalog ? [] : await resolveCoverOriginals(coverTitle);
          const merged = [...lookup, ...extra].filter(
            (item, index, list) =>
              item.artist &&
              list.findIndex((entry) => entry.artist.toLowerCase() === item.artist.toLowerCase()) === index,
          );
          if (extra.length > 0) {
            remote = await fetchRemoteSyncedLyrics(extra, seconds);
          }
          if (!remote?.lines.length && merged.length > 0) {
            remote = await fetchPlainRemoteLyrics(merged, seconds);
          }
        }
      } else {
        remote = await fetchRemoteSyncedLyrics(queries, seconds);
        if (!remote?.lines.length && deep) {
          const catalog = await catalogQueriesForSong(queries);
          if (catalog.length > 0) {
            remote = await fetchRemoteSyncedLyrics(catalog, seconds);
          }
          if (!remote?.lines.length) {
            remote = await fetchPlainRemoteLyrics([...catalog, ...queries], seconds);
          }
        }
      }
      if (remote?.lines.length) {
        if (remote.raw && remote.synced) await saveLibraryLrc(song, remote.raw);
        cache.set(key, remote);
        return remote;
      }
      cache.set(key, local);
      return local;
    } catch {
      return local;
    }
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, task);
  return task;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasSavedLrc(song: Song): boolean {
  try {
    const fileName = basename(song.localPath);
    const name = `${stem(fileName || sanitizeFilename(song.title) || `track-${song.id}`)}.lrc`;
    return new File(getVibxDirectory(), name).exists;
  } catch {
    return false;
  }
}

export async function prefetchLibraryLyrics(songs: Song[]): Promise<void> {
  for (const song of songs) {
    if (!song?.id || !song.localPath) continue;
    if (hasSavedLrc(song)) continue;
    try {
      await loadTrackLyrics(song, song.duration, { deep: false });
    } catch {
      // Keep going so one failed lookup does not stop the library.
    }
    await delay(280);
  }
}

export async function copySidecarLyrics(sourceUri: string, destAudioName: string): Promise<void> {
  const dest = new File(getVibxDirectory(), `${stem(destAudioName)}.lrc`);
  if (dest.exists) return;

  for (const ext of ['.lrc', '.LRC']) {
    const from = replaceExt(sourceUri, ext);
    try {
      const source = new File(from);
      if (!source.exists) continue;
      try {
        await source.copy(dest, { overwrite: true });
      } catch {
        await FileSystem.copyAsync({ from, to: dest.uri });
      }
      return;
    } catch {
      try {
        await FileSystem.copyAsync({ from, to: dest.uri });
        return;
      } catch {
        // Sidecar may not exist next to a content URI.
      }
    }
  }
}

