import { create } from 'zustand';
import { Platform } from 'react-native';
import { scanDeviceMusic, scanDownloadsFolder } from '@/src/services/downloads/scan';
import { getLibraryStorageBytes } from '@/src/services/downloads/libraryDir';
import {
  getDownloadsFolderUri,
  requestDownloadsFolderAccess,
} from '@/src/services/downloads/permissions';
import {
  CatalogDownloadUnavailableError,
  downloadAuthorizedTrack,
} from '@/src/services/downloads/catalogDownload';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { useCatalogStore } from '@/src/stores/catalogStore';
import { usePlayerStore } from '@/src/stores/playerStore';
import type { DownloadJob } from '@/src/types/catalog';
import type { Song } from '@/src/types/music';
import { isCatalogSongId } from '@/src/utils/catalog';

const controllers = new Map<string, AbortController>();

function patchJob(
  set: (partial: Partial<DownloadState>) => void,
  get: () => DownloadState,
  songId: string,
  patch: Partial<DownloadJob>,
) {
  const current = get().jobs[songId];
  if (!current) return;
  set({ jobs: { ...get().jobs, [songId]: { ...current, ...patch } } });
}

type DownloadState = {
  busy: boolean;
  message: string | null;
  storageBytes: number;
  downloadsAccess: boolean;
  jobs: Record<string, DownloadJob>;
  refreshStorage: () => void;
  refreshAccess: () => Promise<void>;
  requestDownloadsAccess: () => Promise<boolean>;
  importFiles: () => Promise<number>;
  scanDevice: () => Promise<number>;
  syncDownloads: () => Promise<Song[]>;
  downloadSong: (song: Song) => Promise<boolean>;
  cancelDownload: (songId: string) => void;
  dismissJob: (songId: string) => void;
  removeCatalogDownload: (song: Song) => Promise<void>;
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
  jobs: {},
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
  downloadSong: async (song) => {
    const existing = get().jobs[song.id];
    if (existing?.status === 'queued' || existing?.status === 'downloading') {
      return false;
    }

    const sourceUrl = song.downloadUrl;
    const job: DownloadJob = {
      songId: song.id,
      title: song.title,
      artist: song.artist,
      artwork: song.artwork,
      progress: 0,
      status: sourceUrl ? 'queued' : 'unavailable',
      error: sourceUrl
        ? undefined
        : 'A full authorized file is not available for this track',
    };
    set({ jobs: { ...get().jobs, [song.id]: job } });

    if (!sourceUrl) {
      set({
        message: 'Deezer only provides a 30-second preview. A full file is not available to save.',
      });
      return false;
    }

    const controller = new AbortController();
    controllers.set(song.id, controller);
    patchJob(set, get, song.id, { status: 'downloading', progress: 0.02 });

    try {
      const downloaded = await downloadAuthorizedTrack(
        song,
        (ratio) => patchJob(set, get, song.id, { progress: ratio, status: 'downloading' }),
        controller.signal,
      );
      useCatalogStore.getState().remember([downloaded]);
      await useLibraryStore.getState().refresh();
      get().refreshStorage();
      patchJob(set, get, song.id, { status: 'done', progress: 1, error: undefined });
      set({ message: `Saved ${downloaded.title} to Downloads/VibX` });
      usePlayerStore.getState().replaceIfPlaying(downloaded);
      return true;
    } catch (error) {
      if (controller.signal.aborted) {
        const { [song.id]: _removed, ...rest } = get().jobs;
        set({ jobs: rest });
        return false;
      }
      const unavailable = error instanceof CatalogDownloadUnavailableError;
      patchJob(set, get, song.id, {
        status: unavailable ? 'unavailable' : 'error',
        error: error instanceof Error ? error.message : 'Download failed',
      });
      set({
        message: error instanceof Error ? error.message : 'Download failed',
      });
      return false;
    } finally {
      controllers.delete(song.id);
    }
  },
  cancelDownload: (songId) => {
    controllers.get(songId)?.abort();
    controllers.delete(songId);
    const { [songId]: _removed, ...rest } = get().jobs;
    set({ jobs: rest });
  },
  dismissJob: (songId) => {
    controllers.get(songId)?.abort();
    controllers.delete(songId);
    const { [songId]: _removed, ...rest } = get().jobs;
    set({ jobs: rest });
  },
  removeCatalogDownload: async (song) => {
    if (!isCatalogSongId(song.id)) return;
    await useLibraryStore.getState().removeSong(song);
    const { [song.id]: _removed, ...rest } = get().jobs;
    set({ jobs: rest, message: `Removed ${song.title}` });
    get().refreshStorage();
  },
}));
