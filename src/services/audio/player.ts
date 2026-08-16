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

let setupPromise: Promise<void> | null = null;

function applyRemoteCommands() {
  TrackPlayer.setCommands(REMOTE_COMMANDS);
}

export function songToMediaItem(song: Song): MediaItem {
  const labels = normalizeTrackLabels(song.title, song.artist);
  return {
    mediaId: song.id,
    url: song.localPath,
    title: labels.title,
    artist: labels.artist,
    albumTitle: song.album,
    artworkUrl: song.artwork ?? undefined,
    duration: song.duration || undefined,
    extras: { songId: song.id },
  };
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
  applyRemoteCommands();
  TrackPlayer.setShuffleEnabled(false);
  TrackPlayer.clear();
  TrackPlayer.setMediaItems(songs.map(songToMediaItem), Math.max(0, startIndex));
  TrackPlayer.setShuffleEnabled(shuffle);
  TrackPlayer.setRepeatMode(toRepeatMode(repeat));
  TrackPlayer.play();
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
