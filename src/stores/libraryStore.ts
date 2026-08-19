import { create } from 'zustand';
import { File, Paths } from 'expo-file-system';
import * as db from '@/src/services/database';
import { backfillMissingDurations, backfillSongMetadata, deleteLocalSongFile } from '@/src/services/downloads/import';
import { prefetchLibraryLyrics } from '@/src/services/lyrics/loadLyrics';
import type { Playlist, Song } from '@/src/types/music';
import { isLockedPlaylist, VIBED_PLAYLIST_ID } from '@/src/constants/playlists';
import { warmupLibraryCatalog } from '@/src/utils/libraryCatalog';
import { dedupeSongs } from '@/src/utils/songIdentity';
import { normalizeDuration } from '@/src/utils/audioDuration';
import { ensureWebMockSong } from '@/src/services/webMockSong';
import { Platform } from 'react-native';

type LibraryState = {
  songs: Song[];
  playlists: Playlist[];
  favorites: Song[];
  recent: Song[];
  popular: Song[];
  playStats: Record<string, number>;
  ready: boolean;
  load: () => Promise<void>;
  runMaintenance: () => Promise<void>;
  refresh: () => Promise<void>;
  recordPlay: (songId: string) => Promise<void>;
  recordCompletedPlay: (songId: string) => Promise<void>;
  toggleFavorite: (songId: string) => Promise<boolean>;
  isFavorite: (songId: string) => boolean;
  createPlaylist: (name: string) => Promise<Playlist>;
  addToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  removeSong: (song: Song) => Promise<void>;
  setSongDuration: (songId: string, duration: number) => Promise<void>;
};

const METADATA_BACKFILL_MARKER = 'library-metadata-backfill-v1';
let maintenancePromise: Promise<void> | null = null;

export const useLibraryStore = create<LibraryState>((set, get) => ({
  songs: [],
  playlists: [],
  favorites: [],
  recent: [],
  popular: [],
  playStats: {},
  ready: false,
  load: async () => {
    await db.initDatabase();
    if (Platform.OS === 'web') {
      await ensureWebMockSong();
    } else {
      const demos = await db.deleteDemoSongs();
      await Promise.all(demos.map((song) => deleteLocalSongFile(song.localPath)));
    }
    await get().refresh();
    set({ ready: true });
  },
  runMaintenance: () => {
    if (maintenancePromise) return maintenancePromise;
    maintenancePromise = (async () => {
      await Promise.all(
        get().favorites.map((song) => db.addSongToPlaylist(VIBED_PLAYLIST_ID, song.id))
      );
      if (Platform.OS === 'web') return;

      const extras = await db.mergeDuplicateSongs();
      if (extras.length > 0) {
        const remaining = new Set(
          (await db.getSongs()).map((song) => song.localPath.toLowerCase())
        );
        await Promise.all(
          extras
            .filter((song) => song.localPath && !remaining.has(song.localPath.toLowerCase()))
            .map((song) => deleteLocalSongFile(song.localPath))
        );
        await get().refresh();
      }

      let changed = await backfillMissingDurations(get().songs);
      const marker = new File(Paths.document, METADATA_BACKFILL_MARKER);
      if (!marker.exists) {
        changed = (await backfillSongMetadata(get().songs)) || changed;
        try {
          marker.create();
          marker.write('done');
        } catch {
          // A failed marker only means maintenance may retry on the next launch.
        }
      }
      if (changed) await get().refresh();
      void prefetchLibraryLyrics(get().songs);
    })();
    return maintenancePromise;
  },
  refresh: async () => {
    const [songs, playlists, favorites, recent, popular, playStats] = await Promise.all([
      db.getSongs(),
      db.getPlaylists(),
      db.getFavorites(),
      db.getRecent(),
      db.getPopular(),
      db.getPlayStats(),
    ]);
    const uniqueSongs = dedupeSongs(songs);
    set({
      songs: uniqueSongs,
      playlists,
      favorites: dedupeSongs(favorites),
      recent: dedupeSongs(recent),
      popular: dedupeSongs(popular),
      playStats,
    });
    warmupLibraryCatalog(uniqueSongs);
  },
  recordPlay: async (songId) => {
    await db.recordPlay(songId);
    const recent = await db.getRecent();
    set({ recent: dedupeSongs(recent) });
  },
  recordCompletedPlay: async (songId) => {
    await db.recordCompletedPlay(songId);
    const [popular, playStats] = await Promise.all([db.getPopular(), db.getPlayStats()]);
    set({ popular: dedupeSongs(popular), playStats });
  },
  toggleFavorite: async (songId) => {
    const liked = await db.toggleFavorite(songId);
    if (liked) await db.addSongToPlaylist(VIBED_PLAYLIST_ID, songId);
    else await db.removeSongFromPlaylist(VIBED_PLAYLIST_ID, songId);
    const favorites = await db.getFavorites();
    set({ favorites });
    return liked;
  },
  isFavorite: (songId) => get().favorites.some((song) => song.id === songId),
  createPlaylist: async (name) => {
    const playlist = await db.createPlaylist(name);
    const playlists = [playlist, ...get().playlists.filter((item) => item.id !== playlist.id)].sort(
      (a, b) => Number(isLockedPlaylist(b)) - Number(isLockedPlaylist(a))
    );
    set({ playlists });
    return playlist;
  },
  addToPlaylist: async (playlistId, songId) => {
    await db.addSongToPlaylist(playlistId, songId);
  },
  removeSong: async (song) => {
    await db.deleteSong(song.id);
    await deleteLocalSongFile(song.localPath);
    await get().refresh();
  },
  setSongDuration: async (songId, duration) => {
    const next = normalizeDuration(duration);
    if (next <= 0) return;
    const current = get().songs.find((song) => song.id === songId);
    if (!current) return;
    if (current.duration > 0 && Math.abs(current.duration - next) <= 1.5) return;
    await db.updateSongDuration(songId, next, true);
    set({
      songs: get().songs.map((song) => (song.id === songId ? { ...song, duration: next } : song)),
      favorites: get().favorites.map((song) => (song.id === songId ? { ...song, duration: next } : song)),
      recent: get().recent.map((song) => (song.id === songId ? { ...song, duration: next } : song)),
    });
  },
}));
