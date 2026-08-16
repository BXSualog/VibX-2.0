import { Directory, Paths } from 'expo-file-system';

export const VIBX_FOLDER_NAME = 'VibX';

export function getVibxDirectory(): Directory {
  const dir = new Directory(Paths.document, VIBX_FOLDER_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export function getLibraryStorageBytes(): number {
  const dir = getVibxDirectory();
  return dir.size ?? 0;
}
