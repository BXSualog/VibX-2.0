import { create } from 'zustand';
import { Platform } from 'react-native';
import { scanDeviceMusic, scanDownloadsFolder } from '@/src/services/downloads/scan';
import { getLibraryStorageBytes } from '@/src/services/downloads/libraryDir';
import {
  getDownloadsFolderUri,
  requestDownloadsFolderAccess,
} from '@/src/services/downloads/permissions';
import { useLibraryStore } from '@/src/stores/libraryStore';
import type { Song } from '@/src/types/music';

type DownloadState = {
  busy: boolean;
  message: string | null;
  storageBytes: number;
  downloadsAccess: boolean;
  refreshStorage: () => void;
  refreshAccess: () => Promise<void>;
  requestDownloadsAccess: () => Promise<boolean>;
  importFiles: () => Promise<number>;
  scanDevice: () => Promise<number>;
  syncDownloads: () => Promise<Song[]>;
};

let scanQueue: Promise<void> = Promise.resolve();

function enqueueScan<T>(work: () => Promise<T>): Promise<T> {
  const result = scanQueue.then(work, work);
  scanQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  busy: false,
  message: null,
  storageBytes: 0,
  downloadsAccess: false,
  refreshStorage: () => {
    try {
      set({ storageBytes: getLibraryStorageBytes() });
    } catch {
      set({ storageBytes: 0 });
    }
  },
  refreshAccess: async () => {
    set({ downloadsAccess: Boolean(await getDownloadsFolderUri()) });
  },
  requestDownloadsAccess: async () => {
    set({ busy: true, message: 'Allow access to your Downloads folder…' });
    try {
      const uri = await requestDownloadsFolderAccess();
      const granted = Boolean(uri);
      set({
        busy: false,
        downloadsAccess: granted,
        message: granted
          ? 'Downloads folder access granted'
          : 'Downloads folder access was not granted',
      });
      return granted;
    } catch (error) {
      set({
        busy: false,
        downloadsAccess: false,
        message: error instanceof Error ? error.message : 'Could not request Downloads access',
      });
      return false;
    }
  },
  importFiles: async () => {
    return enqueueScan(async () => {
      set({ busy: true, message: 'Importing MP3 files from Downloads…' });
      try {
        const songs = await scanDownloadsFolder((found) => {
          if (found === 0 || found % 25 === 0) {
            set({ message: `Importing from Downloads… ${found} tracks found` });
          }
        });
        await useLibraryStore.getState().refresh();
        get().refreshStorage();
        await get().refreshAccess();
        set({
          busy: false,
          message: songs.length
            ? `Imported ${songs.length} MP3 track(s) from Downloads`
            : 'No MP3 files found in Downloads',
        });
        return songs.length;
      } catch (error) {
        set({
          busy: false,
          message: error instanceof Error ? error.message : 'Import failed',
        });
        return 0;
      }
    });
  },
  scanDevice: async () => {
    return enqueueScan(async () => {
      set({ busy: true, message: 'Scanning this device for MP3 files…' });
      try {
        const songs = await scanDeviceMusic((found) => {
          if (found === 0 || found % 25 === 0) {
            set({ message: `Scanning for MP3 files… ${found} tracks found` });
          }
        });
        await useLibraryStore.getState().refresh();
        await get().refreshAccess();
        set({
          busy: false,
          message: songs.length
            ? `Imported ${songs.length} MP3 track(s) from this device`
            : 'No MP3 files found on this device',
        });
        return songs.length;
      } catch (error) {
        set({
          busy: false,
          message: error instanceof Error ? error.message : 'Scan failed',
        });
        return 0;
      }
    });
  },
  syncDownloads: async () => {
    if (Platform.OS === 'web' || !useLibraryStore.getState().ready) return [];
    return enqueueScan(async () => {
      const before = new Set(useLibraryStore.getState().songs.map((song) => song.id));
      try {
        await scanDownloadsFolder(undefined, {
          requestPermission: 'if-undetermined',
          downloadsOnly: true,
          quick: true,
        });
        await useLibraryStore.getState().refresh();
        get().refreshStorage();
        await get().refreshAccess();
        const added = useLibraryStore.getState().songs.filter((song) => !before.has(song.id));
        if (added.length > 0) {
          set({
            message:
              added.length === 1
                ? 'Added 1 new track from Downloads'
                : `Added ${added.length} new tracks from Downloads`,
          });
        }
        return added;
      } catch {
        return [];
      }
    });
  },
}));
