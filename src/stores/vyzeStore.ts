import { create } from 'zustand';
import TrackPlayer from '@rntp/player';
import { parseCommand } from '@/src/services/vyze/parser';
import { resolvePlayRequest } from '@/src/services/vyze/match';
import { getPlayOrderQueue, skipNext, skipPrevious } from '@/src/services/audio/player';
import {
  abortSpeechRecognition,
  setVoiceMeterListener,
  startSpeechRecognition,
  stopSpeechRecognition,
} from '@/src/services/vyze/speech';
import { getPlaylistSongs } from '@/src/services/database';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { usePlayerStore } from '@/src/stores/playerStore';
import type { Song } from '@/src/types/music';
import { artistAlbumsFromSongs } from '@/src/utils/artistAlbums';
import { shuffled } from '@/src/utils/sort';
import { normalizeTrackLabels } from '@/src/utils/metadata';

export type VyzeMode = 'idle' | 'listening' | 'processing' | 'responding' | 'music' | 'sleep';

type VyzeState = {
  mode: VyzeMode;
  listening: boolean;
  voiceLevel: number;
  voiceFrequency: number;
  panelOpen: boolean;
  lastHeard: string;
  reply: string;
  connected: boolean;
  queueOpen: boolean;
  setListening: (listening: boolean) => void;
  setPanelOpen: (open: boolean) => void;
  setQueueOpen: (open: boolean) => void;
  startListening: () => Promise<void>;
  stopListening: (openPanel?: boolean) => void;
  finishListening: () => Promise<void>;
  closePanel: () => void;
  run: (text: string) => string;
};

export const VYZE_IDLE_REPLY = 'Ask me to play, shuffle, or vibe.';
const IDLE_REPLY = VYZE_IDLE_REPLY;

let processTimer: ReturnType<typeof setTimeout> | null = null;
let respondTimer: ReturnType<typeof setTimeout> | null = null;
let pausedForListen = false;
let listenGeneration = 0;

function clearVyzeTimers() {
  if (processTimer) clearTimeout(processTimer);
  if (respondTimer) clearTimeout(respondTimer);
  processTimer = null;
  respondTimer = null;
}

function restorePlaybackIfNeeded() {
  if (pausedForListen && !usePlayerStore.getState().isPlaying) {
    usePlayerStore.getState().play();
  }
  pausedForListen = false;
}

function playShuffled(songs: Song[]) {
  const player = usePlayerStore.getState();
  const mixed = shuffled(songs);
  if (!player.shuffle) player.toggleShuffle();
  const startIndex = mixed.length > 0 ? Math.floor(Math.random() * mixed.length) : 0;
  player.playAll(mixed, startIndex);
}

function pickRandomAlbum(songs: Song[]) {
  let albums = artistAlbumsFromSongs(songs);
  if (albums.length === 0) albums = artistAlbumsFromSongs(songs, 1);
  if (albums.length === 0) return null;
  return albums[Math.floor(Math.random() * albums.length)];
}

async function pickRandomPlaylist() {
  const playlists = useLibraryStore.getState().playlists;
  const loaded = await Promise.all(
    playlists.map(async (playlist) => ({
      playlist,
      songs: await getPlaylistSongs(playlist.id),
    })),
  );
  const eligible = loaded.filter((entry) => entry.songs.length > 0);
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

function queueReply(): string {
  const upcoming = getPlayOrderQueue().slice(0, 4);
  if (upcoming.length === 0) return 'The queue is empty.';
  const names = upcoming.map((entry, offset) => {
    const labels = normalizeTrackLabels(entry.item.title ?? '', entry.item.artist);
    return offset === 0 ? `Now: ${labels.title}` : labels.title;
  });
  if (names.length === 1) return `Only ${names[0]} is in the queue.`;
  return `Here's the queue. ${names.join(', ')}.`;
}

async function executeCommand(text: string): Promise<string> {
  const intent = parseCommand(text);
  const library = useLibraryStore.getState();
  const player = usePlayerStore.getState();
  const songs = library.songs.filter((song) => song.isDownloaded === 1);
  useVyzeStore.setState({ queueOpen: intent.action === 'queue' });

  switch (intent.action) {
    case 'pause':
      pausedForListen = false;
      player.pause();
      return 'Paused.';
    case 'resume':
      pausedForListen = false;
      player.play();
      return 'Resuming.';
    case 'stop':
      pausedForListen = false;
      player.stop();
      return 'Stopped.';
    case 'next':
      skipNext();
      return 'Skipping ahead.';
    case 'previous':
      skipPrevious();
      return 'Going back.';
    case 'shuffle':
      if (songs.length === 0) return 'You have no downloaded songs yet.';
      playShuffled(songs);
      return 'Shuffling your downloaded songs.';
    case 'random':
    case 'vibe':
    case 'downloaded': {
      if (songs.length === 0) return 'You have no downloaded songs yet.';
      playShuffled(songs);
      if (intent.action === 'vibe') return 'Randomizing the vibe.';
      if (intent.action === 'downloaded') return 'Playing your downloaded songs.';
      return 'Playing a random mix.';
    }
    case 'favorites':
      if (library.favorites.length === 0) return 'Vibed is empty. Heart a track to add it.';
      player.playAll(shuffled(library.favorites), 0);
      return 'Playing your Vibed playlist.';
    case 'nowplaying': {
      const item = TrackPlayer.getActiveMediaItem?.();
      if (!item) return 'Nothing is playing.';
      const song = library.songs.find((entry) => entry.id === item.mediaId);
      const labels = normalizeTrackLabels(song?.title ?? item.title ?? '', song?.artist ?? item.artist);
      return `Playing ${labels.title} by ${labels.artist}.`;
    }
    case 'randomalbum': {
      const album = pickRandomAlbum(songs);
      if (!album) return 'You have no albums yet.';
      player.playAll(album.songs, 0);
      return `Playing ${album.artist}.`;
    }
    case 'randomplaylist': {
      const pick = await pickRandomPlaylist();
      if (!pick) return 'You have no playlists with songs yet.';
      player.playAll(pick.songs, 0);
      return `Playing ${pick.playlist.name}.`;
    }
    case 'queue':
      return queueReply();
    case 'play': {
      const match = resolvePlayRequest(intent, songs);
      if (match.kind === 'none') return `I couldn't find "${match.query}" in your downloads.`;
      if (match.kind === 'single') {
        player.playSong(match.song, songs);
        const labels = normalizeTrackLabels(match.song.title, match.song.artist);
        return `Playing ${labels.title} by ${labels.artist}.`;
      }
      player.playAll(match.songs, 0);
      const label = intent.query.replace(/\b(the)\b/gi, '').trim();
      return `Playing ${match.songs.length} songs matching ${label}.`;
    }
    default:
      return "I didn't catch that. Try play, pause, shuffle, or randomize the vibe.";
  }
}

const SILENT_VOICE = { voiceLevel: 0, voiceFrequency: 0 };

export const useVyzeStore = create<VyzeState>((set, get) => ({
  mode: 'idle',
  listening: false,
  voiceLevel: 0,
  voiceFrequency: 0,
  panelOpen: false,
  lastHeard: '',
  reply: IDLE_REPLY,
  connected: true,
  queueOpen: false,
  setListening: (listening) =>
    set({
      listening,
      mode: listening ? 'listening' : 'idle',
      ...(listening ? {} : SILENT_VOICE),
    }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setQueueOpen: (queueOpen) => set({ queueOpen }),
  startListening: async () => {
    const generation = ++listenGeneration;
    clearVyzeTimers();
    set({ listening: true, mode: 'listening', ...SILENT_VOICE });
    pausedForListen = usePlayerStore.getState().isPlaying;
    if (pausedForListen) usePlayerStore.getState().pause();
    const started = await startSpeechRecognition();
    if (generation !== listenGeneration) {
      void abortSpeechRecognition();
      return;
    }
    if (!started.ok) {
      pausedForListen = false;
      if (started.reason === 'permission') {
        set({
          listening: false,
          mode: 'idle',
          reply: 'I need microphone access to hear you. Allow mic permission and try again.',
          ...SILENT_VOICE,
        });
        return;
      }
      set({
        listening: false,
        mode: 'idle',
        reply: started.message,
        ...SILENT_VOICE,
      });
    }
  },
  stopListening: (openPanel = false) => {
    listenGeneration += 1;
    void abortSpeechRecognition();
    restorePlaybackIfNeeded();
    set((state) => ({
      listening: false,
      mode: state.mode === 'processing' || state.mode === 'responding' ? state.mode : 'idle',
      panelOpen: openPanel ? true : state.panelOpen,
      ...SILENT_VOICE,
    }));
  },
  finishListening: async () => {
    listenGeneration += 1;
    const transcript = await stopSpeechRecognition();
    set((state) => ({
      listening: false,
      mode: state.mode === 'processing' || state.mode === 'responding' ? state.mode : 'idle',
      ...SILENT_VOICE,
    }));
    if (transcript) {
      pausedForListen = false;
      get().run(transcript);
      return;
    }
    restorePlaybackIfNeeded();
    set({
      reply: "I didn't catch that. Hold the button and speak a little longer.",
    });
  },
  closePanel: () => {
    listenGeneration += 1;
    clearVyzeTimers();
    void abortSpeechRecognition();
    restorePlaybackIfNeeded();
    set({ panelOpen: false, listening: false, mode: 'idle', queueOpen: false, ...SILENT_VOICE });
  },
  run: (text): string => {
    const trimmed = text.trim();
    if (!trimmed) return get().reply;

    clearVyzeTimers();
    set({
      lastHeard: trimmed,
      listening: false,
      mode: 'processing',
      ...SILENT_VOICE,
    });

    void executeCommand(trimmed)
      .then((reply) => {
        processTimer = setTimeout(() => {
          set({ reply, mode: 'responding', connected: true });
          respondTimer = setTimeout(() => {
            set((state) =>
              state.mode === 'responding'
                ? { mode: usePlayerStore.getState().isPlaying ? 'music' : 'idle' }
                : state,
            );
          }, 1400);
        }, 520);
      })
      .catch(() => {
        const reply = 'Something went wrong. I am still here with you.';
        set({ connected: false, reply, mode: 'idle' });
      });

    return get().reply;
  },
}));

setVoiceMeterListener((meter) => {
  const state = useVyzeStore.getState();
  if (state.voiceLevel === meter.level && state.voiceFrequency === meter.frequency) return;
  useVyzeStore.setState({
    voiceLevel: meter.level,
    voiceFrequency: meter.frequency,
  });
});
