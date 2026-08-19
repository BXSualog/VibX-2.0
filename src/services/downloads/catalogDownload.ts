import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Platform } from 'react-native';
import { upsertSong } from '@/src/services/database';
import {
  getPublicDownloadsDirectory,
  getVibxDirectory,
} from '@/src/services/downloads/libraryDir';
import type { Song } from '@/src/types/music';
import { sanitizeFilename } from '@/src/utils/metadata';

export class CatalogDownloadUnavailableError extends Error {
  constructor(
    message = 'A full authorized file is not available for this track. Deezer only provides a 30-second preview.',
  ) {
    super(message);
    this.name = 'CatalogDownloadUnavailableError';
  }
}

export function catalogDownloadFilename(song: Song): string {
  const base = sanitizeFilename(`${song.title} - ${song.artist}`) || `track-${Date.now()}`;
  return base.toLowerCase().endsWith('.mp3') ? base : `${base}.mp3`;
}

export function catalogSourceUrl(song: Song): string | null {
  return song.downloadUrl || null;
}

type ProgressEvent = {
  bytesWritten?: number;
  totalBytes?: number;
  totalBytesWritten?: number;
  totalBytesExpectedToWrite?: number;
};

function isAlreadyExistsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists/i.test(message);
}

function removeExisting(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // Overwrite via idempotent download if delete is blocked.
  }
}

async function requestMediaAccess(): Promise<void> {
  try {
    await MediaLibrary.requestPermissionsAsync();
  } catch {
    // Playback still works from the app folder if media permission is denied.
  }
}

async function copyIntoDownloadsAlbum(localUri: string): Promise<void> {
  try {
    const asset = await MediaLibrary.createAssetAsync(localUri);
    const albums = await MediaLibrary.getAlbumsAsync();
    const downloadAlbum = albums.find((album) => {
      const name = album.title.trim().toLowerCase();
      return name === 'download' || name === 'downloads' || name === 'vibx';
    });
    if (downloadAlbum) {
      await MediaLibrary.addAssetsToAlbumAsync([asset], downloadAlbum, false);
      return;
    }
    await MediaLibrary.createAlbumAsync('Download', asset, false);
  } catch {
    // Direct file write may already have placed the MP3 in Download/VibX.
  }
}

async function downloadToFile(
  url: string,
  dest: File,
  signal: AbortSignal | undefined,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  removeExisting(dest);
  try {
    return await File.downloadFileAsync(url, dest, {
      signal,
      idempotent: true,
      onProgress: (event: ProgressEvent) => {
        const written = event.totalBytesWritten ?? event.bytesWritten ?? 0;
        const total = event.totalBytesExpectedToWrite ?? event.totalBytes ?? 0;
        if (total > 0) onProgress?.(Math.min(0.95, written / total));
      },
    });
  } catch (error) {
    if (isAlreadyExistsError(error) && dest.exists) return dest;
    throw error;
  }
}

export async function downloadAuthorizedTrack(
  song: Song,
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<Song> {
  const url = catalogSourceUrl(song);
  if (!url) {
    throw new CatalogDownloadUnavailableError();
  }
  if (Platform.OS === 'web') {
    throw new Error('Catalog downloads are available on the mobile app.');
  }

  await requestMediaAccess();
  onProgress?.(0.05);

  const filename = catalogDownloadFilename(song);
  const publicDest = new File(getPublicDownloadsDirectory(), filename);
  const appDest = new File(getVibxDirectory(), filename);
  let localPath = '';

  try {
    const output = await downloadToFile(url, publicDest, signal, onProgress);
    localPath = output.uri;
  } catch (error) {
    if (isAlreadyExistsError(error) && publicDest.exists) {
      localPath = publicDest.uri;
    } else {
      const fallback = await downloadToFile(url, appDest, signal, onProgress);
      localPath = fallback.uri;
      try {
        removeExisting(publicDest);
        await FileSystem.copyAsync({
          from: fallback.uri,
          to: publicDest.uri,
        });
        localPath = publicDest.uri;
      } catch {
        await copyIntoDownloadsAlbum(fallback.uri);
      }
    }
  }

  try {
    await copyIntoDownloadsAlbum(localPath);
  } catch {
    // File is already on disk for playback.
  }

  onProgress?.(1);

  const next: Song = {
    ...song,
    localPath,
    isDownloaded: 1,
    duration: song.duration,
    createdAt: song.createdAt || Date.now(),
  };
  await upsertSong(next);
  return next;
}
