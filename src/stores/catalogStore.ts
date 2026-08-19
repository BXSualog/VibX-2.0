import { create } from 'zustand';
import { useLibraryStore } from '@/src/stores/libraryStore';
import type { Song } from '@/src/types/music';

type CatalogState = {
  byId: Record<string, Song>;
  remember: (songs: Song[]) => void;
};

export const useCatalogStore = create<CatalogState>((set, get) => ({
  byId: {},
  remember: (songs) => {
    if (songs.length === 0) return;
    const byId = { ...get().byId };
    for (const song of songs) {
      if (!song?.id) continue;
      byId[song.id] = song;
    }
    set({ byId });
  },
}));

export function resolveSongById(id: string | undefined | null): Song | undefined {
  if (!id) return undefined;
  const local = useLibraryStore.getState().songs.find((song) => song.id === id);
  if (local) return local;
  return useCatalogStore.getState().byId[id];
}

export function mergeWithLibrary(song: Song): Song {
  const local = useLibraryStore.getState().songs.find((item) => item.id === song.id);
  return local?.isDownloaded ? local : song;
}
