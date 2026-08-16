import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import { getVibxDirectory, VIBX_FOLDER_NAME } from '@/src/services/downloads/libraryDir';
import { getSongByFilename, getSongByPath, updateSongDuration, upsertSong } from '@/src/services/database';
import { createId } from '@/src/utils/id';
import { normalizeDuration, readFileDuration } from '@/src/utils/audioDuration';
import { decodeDisplayName, isAudioFilename, resolveTrackMetadata, sanitizeFilename } from '@/src/utils/metadata';
import type { Song } from '@/src/types/music';
import TrackPlayer from '@rntp/player';

type IngestOptions = {
  album?: string;
  copy?: boolean;
  duration?: number;
  filename?: string;
};

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function importAudioFiles(): Promise<Song[]> {
  let files: File[] = [];

  try {
    const result = await File.pickFileAsync({
      multipleFiles: true,
      mimeTypes: ['audio/*', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/aac'],
    });
    if (!result.canceled && result.result) {
      files = Array.isArray(result.result) ? result.result : [result.result];
    }
  } catch {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!picked.canceled) {
      files = picked.assets.map((asset) => new File(asset.uri));
    }
  }

  const imported: Song[] = [];
  for (const source of files) {
    const song = await ingestFile(source);
    if (song) imported.push(song);
  }
  return imported;
}

async function refreshExistingDuration(existing: Song, suppliedDuration?: number): Promise<Song> {
  let duration = normalizeDuration(suppliedDuration);
  if (duration <= 0 && existing.duration <= 0) {
    duration = await readFileDuration(existing.localPath);
  }
  if (
    duration > 0 &&
    (existing.duration <= 0 || Math.abs(existing.duration - duration) > 1.5)
  ) {
    await updateSongDuration(existing.id, duration, true);
    return { ...existing, duration };
  }
  return existing;
}

export async function ingestFile(source: File, options?: IngestOptions): Promise<Song | null> {
  const rawName = decodeDisplayName(options?.filename || source.name || '');
  if (rawName.includes('.') && !isAudioFilename(rawName) && !isAudioFilename(source.uri)) {
    return null;
  }

  const filename = sanitizeFilename(rawName || `imported-${Date.now()}.mp3`);
  const existingByFilename = await getSongByFilename(filename);
  if (existingByFilename) {
    return refreshExistingDuration(existingByFilename, options?.duration);
  }

  const copy = options?.copy !== false || source.uri.startsWith('content:');
  let localPath = source.uri;

  if (copy) {
    const dest = new File(getVibxDirectory(), filename);
    try {
      if (!dest.exists) {
        try {
          await source.copy(dest, { overwrite: true });
        } catch {
          await FileSystem.copyAsync({ from: source.uri, to: dest.uri });
        }
      }
      localPath = dest.uri;
    } catch {
      localPath = source.uri;
    }
  }

  const existing =
    (await getSongByPath(localPath)) ??
    (await getSongByPath(source.uri));
  if (existing) {
    return refreshExistingDuration(existing, options?.duration);
  }

  const sourceSize = source.size;
  let duration = normalizeDuration(options?.duration, sourceSize);
  if (duration <= 0) {
    duration = await readFileDuration(localPath, sourceSize);
  }

  const meta = await resolveTrackMetadata(localPath, filename);
  const song: Song = {
    id: createId(),
    title: meta.title,
    artist: meta.artist,
    album: meta.album ?? options?.album ?? 'Imported',
    previewUrl: null,
    downloadUrl: null,
    duration,
    previewDuration: 30,
    artwork: null,
    localPath,
    isDownloaded: 1,
    isDemo: 0,
    createdAt: Date.now(),
  };

  await upsertSong(song);

  if (copy) {
    try {
      await MediaLibrary.requestPermissionsAsync();
      await MediaLibrary.createAssetAsync(localPath);
    } catch {
      // Scoped storage may block MediaStore writes; app library still works.
    }
  }

  return song;
}

export async function deleteLocalSongFile(localPath: string): Promise<void> {
  try {
    const libraryUri = getVibxDirectory().uri.replace(/\/$/, '').toLowerCase();
    const path = localPath.toLowerCase();
    const inAppLibrary =
      path.startsWith(libraryUri) || path.includes(`/${VIBX_FOLDER_NAME.toLowerCase()}/`);
    if (!inAppLibrary) return;

    const file = new File(localPath);
    if (file.exists) file.delete();
  } catch {
    // File may already be gone.
  }
}

export async function backfillMissingDurations(songs: Song[]): Promise<boolean> {
  const missing = songs.filter((song) => !song.duration || song.duration <= 0);
  if (missing.length === 0) return false;

  const remaining = new Map(missing.map((song) => [song.id, song]));
  const byName = new Map<string, Song>();
  for (const song of missing) {
    const name = (song.localPath.split(/[/\\]/).pop() ?? song.title).toLowerCase();
    byName.set(name, song);
  }

  let updated = false;

  try {
    const permission = await MediaLibrary.getPermissionsAsync(false, ['audio']);
    if (permission.granted) {
      let hasNextPage = true;
      let endCursor: string | undefined;

      while (hasNextPage) {
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: MediaLibrary.MediaType.audio,
          first: 200,
          after: endCursor,
        });

        for (const asset of page.assets) {
          const song = byName.get((asset.filename || '').toLowerCase());
          if (!song || !remaining.has(song.id)) continue;
          const duration = normalizeDuration(asset.duration);
          if (duration <= 0) continue;
          await updateSongDuration(song.id, duration, true);
          remaining.delete(song.id);
          updated = true;
        }

        hasNextPage = page.hasNextPage;
        endCursor = page.endCursor;
      }
    }
  } catch {
    // Media library may be unavailable; file headers still work.
  }

  for (const song of remaining.values()) {
    try {
      const duration = await readFileDuration(song.localPath);
      if (duration <= 0) continue;
      await updateSongDuration(song.id, duration, true);
      updated = true;
    } catch {
      // File may be unreadable.
    }
    await yieldToUi();
  }

  return updated;
}

function filenameFromPath(path: string, fallback: string): string {
  const raw = path.split(/[/\\]/).pop() ?? '';
  const decoded = decodeDisplayName(raw);
  if (isAudioFilename(decoded) || isAudioFilename(raw)) return decoded || raw;
  return decodeDisplayName(fallback) || fallback;
}

export async function backfillSongMetadata(songs: Song[]): Promise<boolean> {
  if (songs.length === 0) return false;
  const known = songs.map((song) => song.artist);
  let updated = false;

  for (const song of songs) {
    try {
      const filename = filenameFromPath(song.localPath, `${song.title}.mp3`);
      const meta = await resolveTrackMetadata(song.localPath, filename, known);
      const album = meta.album && meta.album !== song.album ? meta.album : song.album;
      if (meta.title === song.title && meta.artist === song.artist && album === song.album) continue;

      const next = { ...song, title: meta.title, artist: meta.artist, album };
      await upsertSong(next);
      updated = true;

      try {
        const index = TrackPlayer.getActiveMediaItemIndex?.() ?? null;
        const active = TrackPlayer.getActiveMediaItem?.();
        if (index != null && active?.mediaId === song.id) {
          TrackPlayer.updateMetadata(index, {
            title: next.title,
            artist: next.artist,
            albumTitle: next.album,
          });
        }
      } catch {
        // Player may not be ready during bootstrap.
      }
    } catch {
      // Unreadable files keep their stored title/artist.
    }
    await yieldToUi();
  }

  return updated;
}
