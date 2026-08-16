import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useActiveMediaItem } from '@rntp/player';
import { Artwork } from '@/src/components/Artwork';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { usePlayerStore } from '@/src/stores/playerStore';
import { normalizeTrackLabels } from '@/src/utils/metadata';

export function VyzeNowPlaying() {
  const item = useActiveMediaItem();
  const playing = usePlayerStore((state) => state.isPlaying);
  const songs = useLibraryStore((state) => state.songs);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const skipNext = usePlayerStore((state) => state.skipNext);
  const skipPrevious = usePlayerStore((state) => state.skipPrevious);

  if (!item) {
    return (
      <View className="mt-4 w-full rounded-2xl bg-white/10 px-4 py-3">
        <Text className="text-center text-sm text-white/55">Nothing playing yet.</Text>
      </View>
    );
  }

  const song = songs.find((entry) => entry.id === item.mediaId);
  const labels = normalizeTrackLabels(song?.title ?? item.title ?? 'Unknown', song?.artist ?? item.artist);
  const artwork = song?.artwork ?? (typeof item.artworkUrl === 'string' ? item.artworkUrl : null);

  return (
    <View
      className="mt-4 w-full flex-row items-center rounded-2xl bg-white/10 px-3 py-2.5"
      style={{ borderWidth: 1, borderColor: 'rgba(186, 230, 253, 0.18)' }}
    >
      <Artwork uri={artwork} title={labels.title} artist={labels.artist} size={44} rounded={10} />
      <View className="ml-2.5 min-w-0 flex-1">
        <Text className="text-[14px] font-bold text-white" numberOfLines={1}>
          {labels.title}
        </Text>
        <Text className="mt-0.5 text-xs text-white/55" numberOfLines={1}>
          {labels.artist}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Previous"
        onPress={skipPrevious}
        className="h-10 w-9 items-center justify-center active:opacity-70"
      >
        <SymbolView
          name={{ ios: 'backward.fill', android: 'skip_previous', web: 'skip_previous' }}
          tintColor="#E0F2FE"
          size={18}
        />
      </Pressable>
      <Pressable
        accessibilityLabel={playing ? 'Pause' : 'Play'}
        onPress={togglePlay}
        className="h-10 w-10 items-center justify-center rounded-full bg-sky-400 active:opacity-80"
      >
        <View style={{ opacity: playing ? 1 : 0, position: playing ? 'relative' : 'absolute' }}>
          <SymbolView
            name={{ ios: 'pause.fill', android: 'pause', web: 'pause' }}
            tintColor="#0B1220"
            size={18}
          />
        </View>
        <View style={{ opacity: playing ? 0 : 1, position: playing ? 'absolute' : 'relative' }}>
          <SymbolView
            name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
            tintColor="#0B1220"
            size={18}
          />
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel="Next"
        onPress={skipNext}
        className="h-10 w-9 items-center justify-center active:opacity-70"
      >
        <SymbolView
          name={{ ios: 'forward.fill', android: 'skip_next', web: 'skip_next' }}
          tintColor="#E0F2FE"
          size={18}
        />
      </Pressable>
    </View>
  );
}
