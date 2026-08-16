import { useEffect, useRef } from 'react';
import { FlatList, Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TrackPlayer, { useActiveMediaItem } from '@rntp/player';
import { getPlayOrderQueue } from '@/src/services/audio/player';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { useVyzeStore } from '@/src/stores/vyzeStore';
import { formatTime } from '@/src/utils/format';
import { normalizeTrackLabels } from '@/src/utils/metadata';

const ROW_HEIGHT = 64;

export function VyzeQueue() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const open = useVyzeStore((state) => state.queueOpen);
  const setQueueOpen = useVyzeStore((state) => state.setQueueOpen);
  const item = useActiveMediaItem();
  const songs = useLibraryStore((state) => state.songs);
  const listRef = useRef<FlatList>(null);
  const playOrder = getPlayOrderQueue();

  useEffect(() => {
    if (!open || playOrder.length === 0) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, item?.mediaId, playOrder.length]);

  function close() {
    setQueueOpen(false);
  }

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={close}>
      <View className="flex-1">
        <Pressable className="flex-1 bg-black/60" onPress={close} />
        <View
          className="px-3"
          style={{ paddingBottom: Math.max(insets.bottom, 14) }}
        >
          <View
            className="overflow-hidden rounded-[32px]"
            style={{
              borderWidth: 1,
              borderColor: 'rgba(147, 197, 253, 0.22)',
              maxHeight: height * 0.78,
            }}
          >
            <LinearGradient
              colors={['#1E3A8A', '#163056', '#0B1220']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}
            >
              <View className="items-center pb-2">
                <View className="h-1.5 w-12 rounded-full bg-white/30" />
              </View>
              <View className="mb-3 flex-row items-center">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold uppercase tracking-[2px] text-sky-200">
                    Vyze
                  </Text>
                  <Text className="mt-0.5 text-[22px] font-bold text-white">Queue</Text>
                </View>
                <Pressable
                  accessibilityLabel="Close queue"
                  onPress={close}
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                >
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    tintColor="#E0F2FE"
                    size={16}
                  />
                </Pressable>
              </View>

              {playOrder.length === 0 ? (
                <View className="items-center px-4 py-10">
                  <Text className="text-center text-[15px] text-white/55">The queue is empty.</Text>
                </View>
              ) : (
                <FlatList
                  ref={listRef}
                  data={playOrder}
                  keyExtractor={({ item: queued, index }) => `${queued.mediaId ?? 'item'}-${index}`}
                  style={{ maxHeight: 420 }}
                  getItemLayout={(_, index) => ({
                    length: ROW_HEIGHT,
                    offset: ROW_HEIGHT * index,
                    index,
                  })}
                  renderItem={({ item: entry, index }) => {
                    const queued = entry.item;
                    const song = songs.find((track) => track.id === queued.mediaId);
                    const labels = normalizeTrackLabels(
                      song?.title ?? queued.title ?? 'Unknown',
                      song?.artist ?? queued.artist,
                    );
                    const current = index === 0;
                    return (
                      <Pressable
                        onPress={() => TrackPlayer.skipToIndex(entry.index)}
                        className="flex-row items-center active:opacity-70"
                        style={{ height: ROW_HEIGHT }}
                      >
                        <Text className="w-11 text-[11px] font-semibold text-sky-200/80">
                          {index === 0 ? 'Now' : index === 1 ? 'Next' : String(index + 1).padStart(2, '0')}
                        </Text>
                        <View className="min-w-0 flex-1">
                          <Text
                            className={
                              current
                                ? 'text-[15px] font-bold text-sky-100'
                                : 'text-[15px] font-semibold text-white'
                            }
                            numberOfLines={1}
                          >
                            {labels.title}
                          </Text>
                          <Text className="mt-0.5 text-xs text-white/45" numberOfLines={1}>
                            {labels.artist}
                          </Text>
                        </View>
                        <Text className="ml-3 text-xs text-white/40">
                          {formatTime(queued.duration || song?.duration || 0)}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              )}
            </LinearGradient>
          </View>
        </View>
      </View>
    </Modal>
  );
}
