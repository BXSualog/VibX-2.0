import TrackPlayer, {
  PlayerCommand,
  RepeatMode,
  type MediaItem,
} from '@rntp/player';
import type { RepeatModeName, Song } from '@/src/types/music';
import { normalizeTrackLabels } from '@/src/utils/metadata';

const REMOTE_COMMANDS = {
  capabilities: [
    PlayerCommand.PlayPause,
    PlayerCommand.Next,
    PlayerCommand.Previous,
    PlayerCommand.Seek,
    PlayerCommand.Stop,
  ],
  handling: 'hybrid' as const,
  perCommandHandling: {
    [PlayerCommand.Next]: 'js' as const,
    [PlayerCommand.Previous]: 'js' as const,
  },
};

const SMALL_QUEUE = 36;
const IMMEDIATE_AHEAD = 18;
const IMMEDIATE_BEHIND = 1;
const FILL_BATCH = 64;

let setupPromise: Promise<void> | null = null;
let playGeneration = 0;

function applyRemoteCommands() {
  TrackPlayer.setCommands(REMOTE_COMMANDS);
}

export function songToMediaItem(song: Song): MediaItem {
  const labels = normalizeTrackLabels(song.title, song.artist);
  const preview = !song.isDownloaded && song.previewUrl;
  return {
    mediaId: song.id,
    url: preview ? song.previewUrl! : song.localPath,
    title: labels.title,
    artist: labels.artist,
    albumTitle: song.album,
    artworkUrl: song.artwork ?? undefined,
    duration: preview
      ? song.previewDuration || 30
      : song.duration || undefined,
    extras: { songId: song.id, preview: preview ? '1' : '0' },
  };
}

function toMediaItems(songs: Song[]): MediaItem[] {
  const items = new Array<MediaItem>(songs.length);
  for (let index = 0; index < songs.length; index += 1) {
    items[index] = songToMediaItem(songs[index]);
  }
  return items;
}

function afterPaint(work: () => void) {
  requestAnimationFrame(() => {
    setTimeout(work, 0);
  });
}

function addInBatches(token: number, songs: Song[], done: () => void) {
  let offset = 0;
  const step = () => {
    if (token !== playGeneration) return;
    if (offset >= songs.length) {
      done();
      return;
    }
    const chunk = songs.slice(offset, offset + FILL_BATCH);
    offset += chunk.length;
    TrackPlayer.addMediaItems(toMediaItems(chunk));
    if (offset >= songs.length) {
      done();
      return;
    }
    setTimeout(step, 16);
  };
  step();
}

function insertBeforeInBatches(token: number, songs: Song[], done: () => void) {
  let remaining = songs.length;
  const step = () => {
    if (token !== playGeneration) return;
    if (remaining <= 0) {
      done();
      return;
    }
    const start = Math.max(0, remaining - FILL_BATCH);
    const chunk = songs.slice(start, remaining);
    remaining = start;
    TrackPlayer.insertMediaItems(0, toMediaItems(chunk));
    if (remaining <= 0) {
      done();
      return;
    }
    setTimeout(step, 16);
  };
  step();
}

function fillQueueLater(
  token: number,
  before: Song[],
  after: Song[],
  shuffle: boolean
) {
  const finish = () => {
    if (token !== playGeneration) return;
    TrackPlayer.setShuffleEnabled(shuffle);
  };

  const insertBefore = () => {
    if (token !== playGeneration) return;
    if (before.length === 0) {
      finish();
      return;
    }
    insertBeforeInBatches(token, before, finish);
  };

  if (after.length === 0) {
    insertBefore();
    return;
  }
  addInBatches(token, after, insertBefore);
}

export async function setupTrackPlayer(): Promise<void> {
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    try {
      TrackPlayer.setupPlayer({
        contentType: 'music',
        handleAudioBecomingNoisy: true,
        android: {
          wakeMode: 'local',
          taskRemovedBehavior: 'continue',
        },
      });
      applyRemoteCommands();
      // Android's MediaController is async; re-apply so lock screen / notification
      // get next+previous after the session connects (PlayPause-only is the default).
      setTimeout(applyRemoteCommands, 250);
      setTimeout(applyRemoteCommands, 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes('already')) {
        setupPromise = null;
        throw error;
      }
    }
  })();

  return setupPromise;
}

export function playQueue(songs: Song[], startIndex = 0, shuffle = false, repeat: RepeatModeName = 'off') {
  if (songs.length === 0) return;
  const index = Math.max(0, Math.min(startIndex, songs.length - 1));
  const token = ++playGeneration;

  applyRemoteCommands();
  TrackPlayer.setShuffleEnabled(false);
  TrackPlayer.setRepeatMode(toRepeatMode(repeat));

  if (songs.length <= SMALL_QUEUE) {
    TrackPlayer.setMediaItems(toMediaItems(songs), index);
    TrackPlayer.setShuffleEnabled(shuffle);
    TrackPlayer.play();
    return;
  }

  const from = Math.max(0, index - IMMEDIATE_BEHIND);
  const to = Math.min(songs.length, index + 1 + IMMEDIATE_AHEAD);
  TrackPlayer.setMediaItems(toMediaItems(songs.slice(from, to)), index - from);
  TrackPlayer.play();

  const after = songs.slice(to);
  const before = songs.slice(0, from);
  if (after.length === 0 && before.length === 0 && !shuffle) return;

  afterPaint(() => {
    if (token !== playGeneration) return;
    fillQueueLater(token, before, after, shuffle);
  });
}

export function toRepeatMode(mode: RepeatModeName): RepeatMode {
  if (mode === 'one') return RepeatMode.One;
  if (mode === 'all') return RepeatMode.All;
  return RepeatMode.Off;
}

/** Queue in the order tracks will actually play, starting at the current song. */
export function getPlayOrderQueue(): { item: MediaItem; index: number }[] {
  const queue = TrackPlayer.getQueue?.() ?? [];
  if (queue.length === 0) return [];

  const active = TrackPlayer.getActiveMediaItemIndex?.() ?? 0;
  const current = Math.min(Math.max(active, 0), queue.length - 1);
  const entries = queue.map((item, index) => ({ item, index }));

  if (TrackPlayer.isShuffleEnabled()) {
    return [entries[current], ...entries.filter((entry) => entry.index !== current)];
  }

  const upcoming = entries.slice(current);
  if (TrackPlayer.getRepeatMode() !== RepeatMode.All) return upcoming;
  return [...upcoming, ...entries.slice(0, current)];
}

/** Always advance. Headset Previous must not restart the current song. */
export function skipNext(): void {
  const queue = TrackPlayer.getQueue();
  if (queue.length === 0) return;
  if (queue.length === 1) {
    TrackPlayer.seekTo(0);
    TrackPlayer.play();
    return;
  }

  if (TrackPlayer.isShuffleEnabled()) {
    TrackPlayer.skipToNext();
    return;
  }

  const index = TrackPlayer.getActiveMediaItemIndex() ?? 0;
  TrackPlayer.skipToIndex((index + 1) % queue.length);
}

/** Always go to the previous track, including after the ~3s native restart threshold. */
export function skipPrevious(): void {
  const queue = TrackPlayer.getQueue();
  if (queue.length === 0) return;
  if (queue.length === 1) {
    TrackPlayer.seekTo(0);
    TrackPlayer.play();
    return;
  }

  if (!TrackPlayer.isShuffleEnabled()) {
    const index = TrackPlayer.getActiveMediaItemIndex() ?? 0;
    TrackPlayer.skipToIndex((index - 1 + queue.length) % queue.length);
    return;
  }

  const position = TrackPlayer.getProgress().position;
  if (position > 0.35) {
    TrackPlayer.seekTo(0);
    setTimeout(() => TrackPlayer.skipToPrevious(), 40);
    return;
  }
  TrackPlayer.skipToPrevious();
}

export { TrackPlayer, RepeatMode };
