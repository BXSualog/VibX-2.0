import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { VyzeNowPlaying } from '@/src/components/Vyze/VyzeNowPlaying';
import { VyzeOrb } from '@/src/components/Vyze/VyzeOrb';
import { VyzeWaveform } from '@/src/components/Vyze/VyzeWaveform';
import { useVyzeVisualMode } from '@/src/components/Vyze/useVyzeVisualMode';
import { useVyzeStore, VYZE_IDLE_REPLY } from '@/src/stores/vyzeStore';
import { colors } from '@/src/theme/colors';

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 850;

const QUICK_ACTIONS = [
  {
    label: 'Shuffle library',
    command: 'Shuffle my downloaded songs',
    icon: { ios: 'shuffle', android: 'shuffle', web: 'shuffle' },
  },
  {
    label: 'Play Vibed',
    command: 'Play Vibed',
    icon: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  },
  {
    label: 'Random album',
    command: 'Play a random album',
    icon: { ios: 'opticaldisc', android: 'album', web: 'album' },
  },
  {
    label: 'Random playlist',
    command: 'Play a random playlist',
    icon: { ios: 'music.note.list', android: 'queue_music', web: 'queue_music' },
  },
] as const;

export function VyzePanel() {
  const insets = useSafeAreaInsets();
  const open = useVyzeStore((state) => state.panelOpen);
  const closePanel = useVyzeStore((state) => state.closePanel);
  const reply = useVyzeStore((state) => state.reply);
  const lastHeard = useVyzeStore((state) => state.lastHeard);
  const run = useVyzeStore((state) => state.run);
  const setQueueOpen = useVyzeStore((state) => state.setQueueOpen);
  const mode = useVyzeVisualMode();
  const [draft, setDraft] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const keyboardOpen = keyboardHeight > 0;
  const hasReply = Boolean(reply) && reply !== VYZE_IDLE_REPLY;
  const dragY = useSharedValue(0);

  useEffect(() => {
    const onShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
    };
    const onHide = () => setKeyboardHeight(0);
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, onShow);
    const hide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setKeyboardHeight(0);
      setDraft('');
      return;
    }
    dragY.value = 0;
  }, [dragY, open]);

  function send(text: string) {
    const value = text.trim();
    if (!value) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    run(value);
    setDraft('');
    Keyboard.dismiss();
  }

  function handleBackdrop() {
    if (keyboardOpen) {
      Keyboard.dismiss();
      return;
    }
    closePanel();
  }

  function dismiss() {
    Keyboard.dismiss();
    closePanel();
  }

  const pan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-28, 28])
    .onUpdate((event) => {
      dragY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      const shouldClose = event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
      if (shouldClose) {
        dragY.value = withTiming(720, { duration: 180 }, (finished) => {
          if (finished) runOnJS(dismiss)();
        });
        return;
      }
      dragY.value = withSpring(0, { damping: 22, stiffness: 240 });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [0, 260], [1, 0.12], Extrapolation.CLAMP),
  }));

  return (
    <Modal visible={open} animationType="fade" transparent onRequestClose={closePanel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[{ flex: 1 }, backdropStyle]}>
          <Pressable className="flex-1 bg-black/60" onPress={handleBackdrop} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            className="px-3"
            style={[
              {
                marginBottom: keyboardHeight,
                paddingBottom: keyboardOpen ? 10 : Math.max(insets.bottom, 14),
              },
              sheetStyle,
            ]}
          >
          <View
            className="overflow-hidden rounded-[32px]"
            style={{
              borderWidth: 1,
              borderColor: 'rgba(147, 197, 253, 0.22)',
              shadowColor: '#38BDF8',
              shadowOpacity: 0.28,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 10 },
              elevation: 18,
            }}
          >
            <LinearGradient
              colors={['#1E3A8A', '#163056', '#0B1220']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{
                paddingHorizontal: 18,
                paddingTop: keyboardOpen ? 12 : 16,
                paddingBottom: keyboardOpen ? 14 : 18,
              }}
            >
              <View className="h-10 items-center justify-center">
                <View className="h-1.5 w-12 rounded-full bg-white/30" />
                <Pressable
                  accessibilityLabel="Show queue"
                  onPress={() => setQueueOpen(true)}
                  className="absolute right-0 top-0 h-10 w-10 items-center justify-center rounded-full bg-white/10"
                >
                  <SymbolView
                    name={{ ios: 'list.bullet', android: 'queue_music', web: 'queue_music' }}
                    tintColor="#E0F2FE"
                    size={18}
                  />
                </Pressable>
              </View>

              <View className="items-center">
                <View className="flex-row items-center">
                  <View style={{ width: keyboardOpen ? 0 : 52, alignItems: 'center' }}>
                    {!keyboardOpen && mode === 'listening' ? (
                      <VyzeWaveform bars={8} height={34} active color="#7DD3FC" />
                    ) : null}
                  </View>
                  <VyzeOrb size={keyboardOpen ? 58 : 104} mode={mode} />
                  <View style={{ width: keyboardOpen ? 0 : 52, alignItems: 'center' }}>
                    {!keyboardOpen && mode === 'listening' ? (
                      <VyzeWaveform bars={8} height={34} active color="#7DD3FC" />
                    ) : null}
                  </View>
                </View>

                <View className="mt-1 rounded-full bg-sky-400/15 px-3 py-1">
                  <Text className="text-[11px] font-bold uppercase tracking-[3px] text-sky-200">
                    Vyze
                  </Text>
                </View>

                {keyboardOpen ? null : <VyzeNowPlaying />}

                {keyboardOpen ? null : (
                  <Text className="mt-3 text-center text-[22px] font-bold leading-7 tracking-tight text-white">
                    How can I help you vibe today?
                  </Text>
                )}

                {hasReply ? (
                  <View className="mt-3 w-full rounded-2xl bg-white/10 px-4 py-3">
                    <Text className="text-center text-[15px] leading-5 text-sky-100">{reply}</Text>
                    {lastHeard ? (
                      <Text className="mt-1 text-center text-xs text-white/45" numberOfLines={1}>
                        You: {lastHeard}
                      </Text>
                    ) : null}
                  </View>
                ) : keyboardOpen ? null : (
                  <Text className="mt-2 text-center text-sm text-white/55">
                    Play a song, shuffle your library, or start Vibed.
                  </Text>
                )}
              </View>

              {keyboardOpen ? null : (
                <View className="mt-5 flex-row flex-wrap" style={{ gap: 10 }}>
                  {QUICK_ACTIONS.map((action) => (
                    <ActionTile key={action.command} action={action} onPress={send} />
                  ))}
                </View>
              )}

              <View
                className="mt-5 flex-row items-center"
                style={{
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderWidth: 1,
                  borderColor: keyboardOpen ? 'rgba(125, 211, 252, 0.55)' : 'rgba(255,255,255,0.16)',
                  paddingLeft: 16,
                  paddingRight: 6,
                  paddingVertical: 6,
                }}
              >
                <TextInput
                  ref={inputRef}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Play a song from your library"
                  placeholderTextColor="rgba(226, 232, 240, 0.45)"
                  className="flex-1 py-2.5 text-[15px] text-white"
                  style={{ color: colors.text }}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  onSubmitEditing={() => send(draft)}
                />
                <Pressable
                  onPress={() => send(draft)}
                  className="h-11 w-11 items-center justify-center rounded-full bg-sky-400"
                >
                  <SymbolView
                    name={{ ios: 'arrow.up', android: 'send', web: 'send' }}
                    tintColor="#0B1220"
                    size={18}
                  />
                </Pressable>
              </View>
            </LinearGradient>
          </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ActionTile({
  action,
  onPress,
}: {
  action: (typeof QUICK_ACTIONS)[number];
  onPress: (command: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(action.command)}
      className="active:opacity-80"
      style={{
        flexGrow: 1,
        flexBasis: '47%',
        minWidth: '47%',
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(186, 230, 253, 0.18)',
        paddingHorizontal: 12,
        paddingVertical: 14,
      }}
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-sky-400/20">
        <SymbolView name={action.icon} tintColor="#E0F2FE" size={16} />
      </View>
      <Text className="mt-2.5 text-[13px] font-semibold text-white">{action.label}</Text>
    </Pressable>
  );
}
