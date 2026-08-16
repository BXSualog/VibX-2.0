import { Directory, File } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import { ingestFile } from '@/src/services/downloads/import';
import { getDownloadsFolderUri } from '@/src/services/downloads/permissions';
import { isMp3Filename } from '@/src/utils/metadata';
import type { Song } from '@/src/types/music';

const ANDROID_DOWNLOAD_PATHS = [
  '/storage/emulated/0/Download',
  '/storage/emulated/0/Downloads',
  '/sdcard/Download',
  '/sdcard/Downloads',
];

const ANDROID_MUSIC_PATHS = [
  ...ANDROID_DOWNLOAD_PATHS,
  '/storage/emulated/0/Music',
  '/storage/emulated/0/Documents',
  '/storage/emulated/0/Podcasts',
  '/storage/emulated/0/Audiobooks',
  '/storage/emulated/0/Recordings',
  '/storage/emulated/0/WhatsApp/Media/WhatsApp Audio',
  '/storage/emulated/0/Telegram/Telegram Audio',
];

const SKIP_DIRS = new Set([
  'android',
  'alarms',
  'notifications',
  'ringtones',
  'thumbnails',
  '.thumbnails',
  'cache',
  'data',
]);

type ScanProgress = (found: number) => void;

export type ScanDownloadsOptions = {
  /** When false, never prompt. `if-undetermined` asks only on first launch. Defaults to true. */
  requestPermission?: boolean | 'if-undetermined';
  /** Only import files that live in a Download/Downloads folder. */
  downloadsOnly?: boolean;
  /** Avoid probing duplicate legacy paths during automatic background scans. */
  quick?: boolean;
};

function isDownloadsAlbumTitle(title?: string | null): boolean {
  const name = (title ?? '').trim().toLowerCase();
  return name === 'download' || name === 'downloads';
}

function isDownloadsLocation(...values: Array<string | null | undefined>): boolean {
  return values.some((value) => {
    if (!value) return false;
    let text = value.replace(/\\/g, '/');
    try {
      text = decodeURIComponent(text);
    } catch {
      // URI may already be decoded or contain invalid sequences.
    }
    const haystack = text.toLowerCase();
    return (
      /\/downloads?\//.test(haystack) ||
      /\/downloads?$/.test(haystack) ||
      /[:/]downloads?[:/]/.test(haystack)
    );
  });
}

function markSeen(seen: Set<string>, ...keys: Array<string | undefined | null>) {
  for (const key of keys) {
    if (key) seen.add(key.toLowerCase());
  }
}

function alreadySeen(seen: Set<string>, ...keys: Array<string | undefined | null>) {
  return keys.some((key) => key && seen.has(key.toLowerCase()));
}

async function importAudioFile(
  source: File,
  imported: Song[],
  seen: Set<string>,
  album?: string,
  duration?: number,
  filename?: string
): Promise<void> {
  const name = filename || source.name || '';
  const looksMp3 = isMp3Filename(name) || isMp3Filename(source.uri) || /\.mp3/i.test(source.uri);
  if (!looksMp3) return;
  if (alreadySeen(seen, source.uri, name, filename)) return;

  markSeen(seen, source.uri, name, filename);
  try {
    const song = await ingestFile(source, {
      album: album ?? 'On this device',
      copy: source.uri.startsWith('content:'),
      duration,
      filename: name,
    });
    if (song) imported.push(song);
  } catch {
    // Some content URIs cannot be opened on every Android build.
  }
}

async function walkDirectory(
  dir: Directory,
  imported: Song[],
  seen: Set<string>,
  depth = 0
): Promise<void> {
  if (depth > 8) return;

  let entries: Array<File | Directory> = [];
  try {
    if (!dir.exists) return;
    entries = dir.list();
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry instanceof Directory) {
      const name = (entry.name ?? '').toLowerCase();
      if (SKIP_DIRS.has(name)) continue;
      await walkDirectory(entry, imported, seen, depth + 1);
      continue;
    }
    if (entry instanceof File) {
      await importAudioFile(entry, imported, seen);
    }
  }
}

async function walkSafDirectory(
  dirUri: string,
  imported: Song[],
  seen: Set<string>,
  depth = 0
): Promise<void> {
  if (depth > 8) return;

  let uris: string[] = [];
  try {
    uris = await StorageAccessFramework.readDirectoryAsync(dirUri);
  } catch {
    try {
      await walkDirectory(new Directory(dirUri), imported, seen, depth);
    } catch {
      // Folder is not readable with this URI.
    }
    return;
  }

  for (const uri of uris) {
    const name = decodeURIComponent(uri.split('/').pop() ?? '');
    if (isMp3Filename(name) || /\.mp3(\?|$)/i.test(uri)) {
      await importAudioFile(new File(uri), imported, seen, 'Downloads', undefined, name);
      continue;
    }
    await walkSafDirectory(uri, imported, seen, depth + 1);
  }
}

async function walkLegacyDirectory(
  dirUri: string,
  imported: Song[],
  seen: Set<string>,
  depth = 0
): Promise<void> {
  if (depth > 8) return;

  let names: string[] = [];
  try {
    names = await FileSystem.readDirectoryAsync(dirUri);
  } catch {
    return;
  }

  for (const name of names) {
    const child = dirUri.replace(/\/$/, '') + '/' + name;
    if (isMp3Filename(name) || /\.mp3(\?|$)/i.test(child)) {
      await importAudioFile(new File(child), imported, seen, 'Downloads', undefined, name);
      continue;
    }
    await walkLegacyDirectory(child, imported, seen, depth + 1);
  }
}

async function scanKnownDownloadPaths(seen: Set<string>, quick = false): Promise<Song[]> {
  const imported: Song[] = [];
  const paths: string[] = [];

  if (!quick) {
    paths.push(
      ...ANDROID_DOWNLOAD_PATHS,
      ...ANDROID_DOWNLOAD_PATHS.map((path) => `file://${path}`)
    );
  }

  if (Platform.OS === 'android' && !quick) {
    try {
      const safUri = StorageAccessFramework.getUriForDirectoryInRoot('Download');
      if (safUri) paths.push(safUri);
    } catch {
      // SAF root URI is unavailable on this device.
    }
  }

  const savedUri = await getDownloadsFolderUri();
  if (savedUri) paths.push(savedUri);

  for (const dirPath of [...new Set(paths)]) {
    try {
      if (dirPath.startsWith('content:')) {
        await walkSafDirectory(dirPath, imported, seen);
      } else {
        await walkDirectory(new Directory(dirPath), imported, seen);
        if (!quick) await walkLegacyDirectory(dirPath, imported, seen);
      }
    } catch {
      // Scoped storage may block some Download paths.
    }
  }

  return imported;
}

export async function scanDownloadsFolder(
  onProgress?: ScanProgress,
  options?: ScanDownloadsOptions
): Promise<Song[]> {
  const seen = new Set<string>();
  const imported: Song[] = [];

  const pathSongs = await scanKnownDownloadPaths(seen, options?.quick);
  imported.push(...pathSongs);
  onProgress?.(imported.length);

  try {
    const mediaSongs = await scanAllMediaLibraryAudio(seen, onProgress, options);
    imported.push(...mediaSongs);
  } catch (error) {
    if (options?.requestPermission !== true && options?.requestPermission !== undefined) {
      onProgress?.(imported.length);
      return imported;
    }
    throw error;
  }
  onProgress?.(imported.length);

  return imported;
}

async function importMediaAsset(
  asset: MediaLibrary.Asset,
  imported: Song[],
  seen: Set<string>,
  downloadsOnly = false
): Promise<void> {
  const filename = asset.filename || '';
  if (!isMp3Filename(filename)) return;
  if (alreadySeen(seen, asset.uri, filename, asset.id)) return;

  try {
    const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: true });
    const uri = info.localUri ?? asset.uri;
    if (!uri || alreadySeen(seen, uri, filename, asset.id)) return;
    if (downloadsOnly && !isDownloadsLocation(uri, asset.uri, info.localUri)) return;

    await importAudioFile(
      new File(uri),
      imported,
      seen,
      info.albumId ? undefined : 'Downloads',
      asset.duration || info.duration,
      filename
    );
  } catch {
    // Some content URIs cannot be copied on every Android build.
  }
}

async function collectMediaAssets(
  mediaType: MediaLibrary.MediaTypeValue,
  album?: MediaLibrary.Album
): Promise<MediaLibrary.Asset[]> {
  const assets: MediaLibrary.Asset[] = [];
  let hasNextPage = true;
  let endCursor: string | undefined;

  while (hasNextPage) {
    const page = await MediaLibrary.getAssetsAsync({
      album,
      mediaType,
      first: 200,
      after: endCursor,
      resolveWithFullInfo: true,
    });
    assets.push(...page.assets);
    hasNextPage = page.hasNextPage;
    endCursor = page.endCursor;
  }

  return assets;
}

async function hasAudioPermission(
  requestPermission: boolean | 'if-undetermined'
): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync(false, ['audio']);
  if (current.granted) return true;
  if (requestPermission === false) return false;
  if (requestPermission === 'if-undetermined' && current.status !== 'undetermined') return false;
  const requested = await MediaLibrary.requestPermissionsAsync(false, ['audio']);
  return requested.granted;
}

async function collectDownloadAlbumAssets(): Promise<MediaLibrary.Asset[]> {
  const assets: MediaLibrary.Asset[] = [];
  const seenIds = new Set<string>();

  async function addAlbum(album?: MediaLibrary.Album | null) {
    if (!album) return;
    try {
      const albumAssets = await collectMediaAssets(MediaLibrary.MediaType.audio, album);
      for (const asset of albumAssets) {
        if (seenIds.has(asset.id)) continue;
        seenIds.add(asset.id);
        assets.push(asset);
      }
    } catch {
      // Skip albums the media store cannot query.
    }
  }

  for (const title of ['Download', 'Downloads']) {
    try {
      await addAlbum(await MediaLibrary.getAlbumAsync(title));
    } catch {
      // Album may not exist on this device.
    }
  }

  try {
    const albums = await MediaLibrary.getAlbumsAsync();
    for (const album of albums) {
      if (!isDownloadsAlbumTitle(album.title)) continue;
      await addAlbum(album);
    }
  } catch {
    // Album listing may be unavailable.
  }
  return assets;
}

async function scanAllMediaLibraryAudio(
  seen: Set<string>,
  onProgress?: ScanProgress,
  options?: ScanDownloadsOptions
): Promise<Song[]> {
  const requestPermission = options?.requestPermission ?? true;
  const downloadsOnly = options?.downloadsOnly === true;
  const granted = await hasAudioPermission(requestPermission);
  if (!granted) {
    if (requestPermission === true) {
      throw new Error('Allow audio access so VibX can import your MP3 files.');
    }
    return [];
  }

  const imported: Song[] = [];
  const assets: MediaLibrary.Asset[] = [];
  let fromDownloadAlbums = false;

  if (downloadsOnly) {
    assets.push(...(await collectDownloadAlbumAssets()));
    fromDownloadAlbums = assets.length > 0;
    if (!fromDownloadAlbums) return [];
  }

  if (!downloadsOnly && assets.length === 0) {
    for (const mediaType of [MediaLibrary.MediaType.audio, MediaLibrary.MediaType.unknown]) {
      try {
        assets.push(...(await collectMediaAssets(mediaType)));
      } catch {
        // Some Android builds reject unknown media queries.
      }
    }
  }

  if (!downloadsOnly && assets.length === 0) {
    try {
      const albums = await MediaLibrary.getAlbumsAsync();
      for (const album of albums) {
        try {
          assets.push(...(await collectMediaAssets(MediaLibrary.MediaType.audio, album)));
        } catch {
          // Skip albums the media store cannot query.
        }
      }
    } catch {
      // Album listing may be unavailable.
    }
  }

  for (const asset of assets) {
    await importMediaAsset(asset, imported, seen, downloadsOnly && !fromDownloadAlbums);
    onProgress?.(imported.length);
  }

  return imported;
}

export async function scanDeviceMusic(onProgress?: ScanProgress): Promise<Song[]> {
  const seen = new Set<string>();
  const imported: Song[] = [];

  const downloadsSongs = await scanDownloadsFolder(onProgress);
  imported.push(...downloadsSongs);
  for (const song of downloadsSongs) {
    markSeen(seen, song.localPath, song.title);
  }
  onProgress?.(imported.length);

  try {
    const mediaLibrarySongs = await scanAllMediaLibraryAudio(seen, onProgress);
    imported.push(...mediaLibrarySongs);
  } catch {
    // Media library permission may be denied; Downloads folder scan still counts.
  }

  if (Platform.OS === 'android') {
    const importedFromPaths: Song[] = [];
    for (const dirPath of ANDROID_MUSIC_PATHS) {
      try {
        await walkDirectory(new Directory(dirPath), importedFromPaths, seen);
      } catch {
        // Some devices block direct filesystem access to shared storage.
      }
    }
    imported.push(...importedFromPaths);
  }

  onProgress?.(imported.length);
  return imported;
}
