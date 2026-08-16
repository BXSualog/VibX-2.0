const COMPLETE_RATIO = 0.92;
const COMPLETE_REMAINING = 1.25;

let last = { mediaId: '', position: 0, duration: 0 };
let countedId = '';

function isFinished(position: number, duration: number): boolean {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return false;
  return position / duration >= COMPLETE_RATIO || duration - position <= COMPLETE_REMAINING;
}

export function notePlaybackProgress(mediaId: string | undefined, position: number, duration: number): string | null {
  const id = mediaId ?? '';
  if (id && countedId === id && position < 2) countedId = '';
  last = { mediaId: id, position, duration };
  if (!id || countedId === id || !isFinished(position, duration)) return null;
  countedId = id;
  return id;
}

export function noteTrackChange(nextId: string | null): string | null {
  const prev = last.mediaId;
  if (!prev || prev === nextId || countedId === prev || !isFinished(last.position, last.duration)) {
    return null;
  }
  countedId = prev;
  return prev;
}
