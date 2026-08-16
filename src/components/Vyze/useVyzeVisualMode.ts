import { usePlayerStore } from '@/src/stores/playerStore';
import { useVyzeStore, type VyzeMode } from '@/src/stores/vyzeStore';

export function useVyzeVisualMode(): VyzeMode {
  const mode = useVyzeStore((state) => state.mode);
  const playing = usePlayerStore((state) => state.isPlaying);

  if (mode === 'listening' || mode === 'processing' || mode === 'responding' || mode === 'sleep') {
    return mode;
  }
  if (playing) return 'music';
  return 'idle';
}
