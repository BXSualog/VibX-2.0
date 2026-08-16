import { useEffect, useRef } from 'react';
import { AppState, InteractionManager, type AppStateStatus } from 'react-native';
import { router, usePathname } from 'expo-router';
import TrackPlayer, { Event, useIsPlaying } from '@rntp/player';
import { setupTrackPlayer } from '@/src/services/audio/player';
import { bindRemoteSkipListeners } from '@/src/services/audio/playbackService';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { useDownloadStore } from '@/src/stores/downloadStore';
import { usePlayerStore } from '@/src/stores/playerStore';
import { artistAlbumForSongs } from '@/src/utils/artistAlbums';
import { notePlaybackProgress, noteTrackChange } from '@/src/services/audio/playStats';
import type { Song } from '@/src/types/music';

function scheduleAfterUiIdle(work: () => void | Promise<void>, delayMs: number): () => void {
  let interaction: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
  let cancelled = false;
  const timer = setTimeout(() => {
    interaction = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) void work();
    });
  }, delayMs);

  return () => {
    cancelled = true;
    clearTimeout(timer);
    interaction?.cancel();
  };
}

function openAlbumForNewSongs(added: Song[], currentPath: string) {
  if (added.length === 0) return;
  if (currentPath.includes('player') || currentPath.includes('album')) return;

  const album = artistAlbumForSongs(
    useLibraryStore.getState().songs,
    added.map((song) => song.id)
  );
  if (!album) return;

  router.push({
    pathname: '/album',
    params: { artist: album.artist },
  });
}

export function useBootstrap() {
  const load = useLibraryStore((state) => state.load);
  const ready = useLibraryStore((state) => state.ready);
  const runMaintenance = useLibraryStore((state) => state.runMaintenance);
  const refreshStorage = useDownloadStore((state) => state.refreshStorage);
  const syncDownloads = useDownloadStore((state) => state.syncDownloads);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const nativePlaying = useIsPlaying();

  useEffect(() => {
    usePlayerStore.getState().syncPlaying(nativePlaying);
  }, [nativePlaying]);

  useEffect(() => {
    let cancelled = false;
    let cancelDownloadsScan: (() => void) | null = null;
    let cancelMaintenance: (() => void) | null = null;

    async function start() {
      await load();
      if (cancelled) return;
      refreshStorage();
      try {
        await setupTrackPlayer();
      } catch {
        // Native module is missing in Expo Go / web; UI still loads.
      }
      if (cancelled) return;
      cancelDownloadsScan = scheduleAfterUiIdle(async () => {
        const added = await syncDownloads();
        if (!cancelled) openAlbumForNewSongs(added, pathnameRef.current);
      }, 500);
      cancelMaintenance = scheduleAfterUiIdle(runMaintenance, 2500);
    }

    void start();
    return () => {
      cancelled = true;
      cancelDownloadsScan?.();
      cancelMaintenance?.();
    };
  }, [load, refreshStorage, runMaintenance, syncDownloads]);

  useEffect(() => {
    let cancelDownloadsScan: (() => void) | null = null;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appState.current === 'background' || appState.current === 'inactive';
      appState.current = nextState;
      if (wasBackground && nextState === 'active') {
        cancelDownloadsScan?.();
        cancelDownloadsScan = scheduleAfterUiIdle(async () => {
          const added = await syncDownloads();
          openAlbumForNewSongs(added, pathnameRef.current);
        }, 300);
      }
    });
    return () => {
      cancelDownloadsScan?.();
      subscription.remove();
    };
  }, [syncDownloads]);

  useEffect(() => {
    const playSub = TrackPlayer.addEventListener(Event.MediaItemTransition, ({ item }) => {
      const songId = item?.mediaId ?? (item?.extras?.songId as string | undefined);
      const finishedId = noteTrackChange(songId ?? null);
      if (finishedId) void useLibraryStore.getState().recordCompletedPlay(finishedId);
      if (songId) void useLibraryStore.getState().recordPlay(songId);
    });
    const progressSub = TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ mediaId, position, duration }) => {
      const finishedId = notePlaybackProgress(mediaId, position, duration);
      if (finishedId) void useLibraryStore.getState().recordCompletedPlay(finishedId);
      if (mediaId && duration > 0) {
        void useLibraryStore.getState().setSongDuration(mediaId, duration);
      }
    });
    const unbindRemote = bindRemoteSkipListeners();
    return () => {
      playSub.remove();
      progressSub.remove();
      unbindRemote();
    };
  }, []);

  return ready;
}
