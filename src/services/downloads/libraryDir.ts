import { Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export const VIBX_FOLDER_NAME = 'VibX';

const ANDROID_DOWNLOAD_VIBX_PATHS = [
  '/storage/emulated/0/Download/VibX',
  '/storage/emulated/0/Downloads/VibX',
  '/sdcard/Download/VibX',
  '/sdcard/Downloads/VibX',
];

function ensureDir(path: string): Directory | null {
  try {
    const dir = new Directory(path);
    if (!dir.exists) {
      dir.create({ intermediates: true, idempotent: true });
    }
    return dir.exists ? dir : null;
  } catch {
    return null;
  }
}

export function getVibxDirectory(): Directory {
  if (Platform.OS === 'web') {
    throw new Error('Local music file storage is not available on web.');
  }

  const dir = new Directory(Paths.document, VIBX_FOLDER_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

/** Public Download/VibX on Android. Falls back to the app library folder. */
export function getPublicDownloadsDirectory(): Directory {
  if (Platform.OS === 'web') {
    throw new Error('Local music file storage is not available on web.');
  }

  if (Platform.OS === 'android') {
    for (const path of ANDROID_DOWNLOAD_VIBX_PATHS) {
      const dir = ensureDir(path);
      if (dir) return dir;
    }
  }

  return getVibxDirectory();
}

export function getLibraryStorageBytes(): number {
  if (Platform.OS === 'web') return 0;

  try {
    return getPublicDownloadsDirectory().size ?? getVibxDirectory().size ?? 0;
  } catch {
    return 0;
  }
}
