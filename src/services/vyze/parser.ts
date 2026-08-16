import type { VyzeIntent } from '@/src/types/music';

function cleanPlayQuery(raw: string): string {
  return raw
    .replace(/^(hey )?(vyze[, ]*)?/i, '')
    .replace(/could you|please|i want to hear|put on/g, '')
    .replace(/\bplay\b/g, '')
    .replace(/\bthe music\b/g, '')
    .trim();
}

export function parseCommand(text: string): VyzeIntent {
  const raw = text.toLowerCase().trim();
  if (!raw) return { action: 'unknown' };

  if (/(pause|hold on|wait)/.test(raw)) return { action: 'pause' };
  if (/(resume|continue|unpause|start again)/.test(raw)) return { action: 'resume' };
  if (/\bstop\b/.test(raw)) return { action: 'stop' };
  if (/(show( the)? queue|what'?s (on deck|next)|up next|\bqueue\b)/.test(raw)) {
    return { action: 'queue' };
  }
  if (/(next( song)?|skip)/.test(raw)) return { action: 'next' };
  if (/(previous|go back|last song)/.test(raw)) return { action: 'previous' };
  if (/randomize the vibe|give me a random vibe/.test(raw)) return { action: 'vibe' };
  if (/(shuffle|mix it up)/.test(raw)) return { action: 'shuffle' };
  if (/random album|play an? album/.test(raw)) return { action: 'randomalbum' };
  if (/random playlist|play an? playlist/.test(raw)) return { action: 'randomplaylist' };
  if (/\brandom\b/.test(raw)) return { action: 'random' };
  if (/(favorites|liked songs|my favorites|vibed)/.test(raw)) return { action: 'favorites' };
  if (/(downloaded|offline|my library)/.test(raw) && /play/.test(raw)) {
    return { action: 'downloaded' };
  }
  if (/(play something chill|play something energetic|play downloaded)/.test(raw)) {
    return { action: 'vibe' };
  }
  if (/(what'?s playing|what is playing|what song is this|what'?s this)/.test(raw)) {
    return { action: 'nowplaying' };
  }

  if (/\bplay\b/.test(raw)) {
    const query = cleanPlayQuery(raw);
    if (!query || query === 'music') return { action: 'downloaded' };
    const byMatch = query.match(/^(.*?)\s+by\s+(.+)$/i);
    if (byMatch?.[1] && byMatch[2]) {
      return {
        action: 'play',
        query,
        title: byMatch[1].trim(),
        artist: byMatch[2].trim(),
      };
    }
    return { action: 'play', query };
  }

  return { action: 'unknown' };
}
