import TrackPlayer, { Event, type BackgroundEvent } from '@rntp/player';
import { skipNext, skipPrevious } from '@/src/services/audio/player';

export async function PlaybackService(event: BackgroundEvent): Promise<void> {
  switch (event.type) {
    case Event.RemoteNext:
      skipNext();
      break;
    case Event.RemotePrevious:
      skipPrevious();
      break;
    case Event.RemotePlay:
      TrackPlayer.play();
      break;
    case Event.RemotePause:
      TrackPlayer.pause();
      break;
    case Event.RemoteStop:
      TrackPlayer.stop();
      break;
    case Event.RemoteSeek:
      TrackPlayer.seekTo(event.position);
      break;
    default:
      break;
  }
}

export function bindRemoteSkipListeners() {
  const next = TrackPlayer.addEventListener(Event.RemoteNext, skipNext);
  const previous = TrackPlayer.addEventListener(Event.RemotePrevious, skipPrevious);
  return () => {
    next.remove();
    previous.remove();
  };
}
