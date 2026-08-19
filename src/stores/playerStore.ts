import { create } from 'zustand';
import TrackPlayer from '@rntp/player';
import { playQueue, skipNext as skipNextTrack, skipPrevious as skipPreviousTrack, songToMediaItem, toRepeatMode } from '@/src/services/audio/player';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { mergeWithLibrary, resolveSongById, useCatalogStore } from '@/src/stores/catalogStore';
import type { RepeatModeName, Song } from '@/src/types/music';

type PlayerState = {
  shuffle: boolean;
  repeat: RepeatModeName;
  isPlaying: boolean;
  currentSong: Song | null;
  playSong: (song: Song, queue?: Song[]) => void;
  playAll: (queue: Song[], startIndex?: number, shuffle?: boolean, repeat?: RepeatModeName) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  playNext: (song: Song) => void;
  addToQueue: (song: Song) => void;
  skipNext: () => void;
  skipPrevious: () => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  syncPlaying: (playing: boolean) => void;
  syncCurrentSong: (song?: Song | null) => void;
  seek: (position: number) => void;
  replaceIfPlaying: (song: Song) => void;
};

function rememberQueue(songs: Song[]) {
  useCatalogStore.getState().remember(songs);
  return songs.map(mergeWithLibrary);
}

function recordIfSaved(songId: string | undefined) {
  if (!songId) return;
  if (!useLibraryStore.getState().songs.some((song) => song.id === songId)) return;
  void useLibraryStore.getState().recordPlay(songId);
}

let ignoreNativeUntil = 0;

function setPlayingNow(isPlaying: boolean, currentSong?: Song | null) {
  ignoreNativeUntil = Date.now() + 800;
  if (currentSong !== undefined) {
    usePlayerStore.setState({ isPlaying, currentSong });
    return;
  }
  usePlayerStore.setState({ isPlaying });
}

function readNativeSong(): Song | null {
  const active = TrackPlayer.getActiveMediaItem?.();
  return (
    resolveSongById(active?.mediaId ?? (active?.extras?.songId as string | undefined)) ??
    null
  );
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  shuffle: false,
  repeat: 'off',
  isPlaying: false,
  currentSong: null,
  playSong: (song, queue) => {
    const source = queue && queue.length > 0 ? queue : useLibraryStore.getState().songs;
    const songs = rememberQueue(source);
    const resolved = mergeWithLibrary(song);
    const index = Math.max(
      0,
      songs.findIndex((item) => item.id === resolved.id)
    );
    setPlayingNow(true, resolved);
    playQueue(songs, index, get().shuffle, get().repeat);
    setTimeout(() => recordIfSaved(resolved.id), 0);
  },
  playAll: (queue, startIndex = 0, shuffle, repeat) => {
    if (queue.length === 0) return;
    const songs = rememberQueue(queue);
    const useShuffle = shuffle ?? get().shuffle;
    const useRepeat = repeat ?? get().repeat;
    if (shuffle !== undefined && shuffle !== get().shuffle) {
      set({ shuffle });
    }
    if (repeat !== undefined && repeat !== get().repeat) {
      set({ repeat });
    }
    setPlayingNow(true, songs[startIndex] ?? null);
    playQueue(songs, startIndex, useShuffle, useRepeat);
    setTimeout(() => recordIfSaved(songs[startIndex]?.id), 0);
  },
  toggleShuffle: () => {
    const shuffle = !get().shuffle;
    TrackPlayer.setShuffleEnabled(shuffle);
    set({ shuffle });
  },
  cycleRepeat: () => {
    const order: RepeatModeName[] = ['off', 'all', 'one'];
    const next = order[(order.indexOf(get().repeat) + 1) % order.length];
    TrackPlayer.setRepeatMode(toRepeatMode(next));
    set({ repeat: next });
  },
  playNext: (song) => {
    const resolved = mergeWithLibrary(song);
    useCatalogStore.getState().remember([resolved]);
    const index = TrackPlayer.getActiveMediaItemIndex() ?? 0;
    TrackPlayer.insertMediaItem(index + 1, songToMediaItem(resolved));
  },
  addToQueue: (song) => {
    const resolved = mergeWithLibrary(song);
    useCatalogStore.getState().remember([resolved]);
    TrackPlayer.addMediaItem(songToMediaItem(resolved));
  },
  skipNext: () => {
    skipNextTrack();
    setTimeout(() => get().syncCurrentSong(), 0);
  },
  skipPrevious: () => {
    skipPreviousTrack();
    setTimeout(() => get().syncCurrentSong(), 0);
  },
  togglePlay: () => {
    if (get().isPlaying) get().pause();
    else get().play();
  },
  play: () => {
    setPlayingNow(true);
    TrackPlayer.play();
  },
  pause: () => {
    setPlayingNow(false);
    TrackPlayer.pause();
  },
  stop: () => {
    setPlayingNow(false, null);
    TrackPlayer.stop();
  },
  syncPlaying: (playing) => {
    if (Date.now() < ignoreNativeUntil) return;
    if (get().isPlaying !== playing) set({ isPlaying: playing });
  },
  syncCurrentSong: (song) => {
    const next = song === undefined ? readNativeSong() : song;
    if (!next) return;
    if (get().currentSong?.id !== next.id) set({ currentSong: next });
  },
  seek: (position) => {
    const active = TrackPlayer.getActiveMediaItem?.();
    const extras = active?.extras as { preview?: string } | undefined;
    if (extras?.preview === '1') {
      TrackPlayer.seekTo(Math.min(position, 30));
      return;
    }
    TrackPlayer.seekTo(position);
  },
  replaceIfPlaying: (song) => {
    const active = TrackPlayer.getActiveMediaItem?.();
    if (!active || active.mediaId !== song.id) return;
    const queue = TrackPlayer.getQueue?.() ?? [];
    const index = TrackPlayer.getActiveMediaItemIndex?.() ?? 0;
    if (queue.length === 0) {
      get().playSong(song, [song]);
      return;
    }
    const songs = queue.map((item, itemIndex) => {
      if (itemIndex === index || item.mediaId === song.id) return song;
      const mediaId = item.mediaId;
      if (!mediaId) return song;
      return (
        useLibraryStore.getState().songs.find((entry) => entry.id === mediaId) ??
        useCatalogStore.getState().byId[mediaId] ??
        song
      );
    });
    get().playSong(song, songs);
  },
}));
