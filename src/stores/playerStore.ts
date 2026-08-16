import { create } from 'zustand';
import TrackPlayer from '@rntp/player';
import { playQueue, skipNext, skipPrevious, songToMediaItem, toRepeatMode } from '@/src/services/audio/player';
import { useLibraryStore } from '@/src/stores/libraryStore';
import type { RepeatModeName, Song } from '@/src/types/music';

type PlayerState = {
  shuffle: boolean;
  repeat: RepeatModeName;
  isPlaying: boolean;
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
  seek: (position: number) => void;
};

let ignoreNativeUntil = 0;

function setPlayingNow(isPlaying: boolean) {
  ignoreNativeUntil = Date.now() + 800;
  usePlayerStore.setState({ isPlaying });
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  shuffle: false,
  repeat: 'off',
  isPlaying: false,
  playSong: (song, queue) => {
    const songs = queue && queue.length > 0 ? queue : useLibraryStore.getState().songs;
    const index = Math.max(
      0,
      songs.findIndex((item) => item.id === song.id)
    );
    setPlayingNow(true);
    playQueue(songs, index, get().shuffle, get().repeat);
    void useLibraryStore.getState().recordPlay(song.id);
  },
  playAll: (queue, startIndex = 0, shuffle, repeat) => {
    if (queue.length === 0) return;
    const useShuffle = shuffle ?? get().shuffle;
    const useRepeat = repeat ?? get().repeat;
    if (shuffle !== undefined && shuffle !== get().shuffle) {
      TrackPlayer.setShuffleEnabled(shuffle);
      set({ shuffle });
    }
    if (repeat !== undefined && repeat !== get().repeat) {
      TrackPlayer.setRepeatMode(toRepeatMode(repeat));
      set({ repeat });
    }
    setPlayingNow(true);
    playQueue(queue, startIndex, useShuffle, useRepeat);
    void useLibraryStore.getState().recordPlay(queue[startIndex]?.id);
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
    const index = TrackPlayer.getActiveMediaItemIndex() ?? 0;
    TrackPlayer.insertMediaItem(index + 1, songToMediaItem(song));
  },
  addToQueue: (song) => {
    TrackPlayer.addMediaItem(songToMediaItem(song));
  },
  skipNext,
  skipPrevious,
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
    setPlayingNow(false);
    TrackPlayer.stop();
  },
  syncPlaying: (playing) => {
    if (Date.now() < ignoreNativeUntil) return;
    if (get().isPlaying !== playing) set({ isPlaying: playing });
  },
  seek: (position) => TrackPlayer.seekTo(position),
}));
