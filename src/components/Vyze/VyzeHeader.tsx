import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { VyzeOrb } from '@/src/components/Vyze/VyzeOrb';
import { VyzeWaveform } from '@/src/components/Vyze/VyzeWaveform';
import { VyzeHoldButton } from '@/src/components/Vyze/VyzeHoldButton';
import { useVyzeVisualMode } from '@/src/components/Vyze/useVyzeVisualMode';
import { useVyzeStore } from '@/src/stores/vyzeStore';
import { greetingForNow } from '@/src/utils/format';

const ORB_SIZE = 92;
const ORB_BOX = ORB_SIZE + ORB_SIZE * 0.34 * 2;
const LISTEN_SCALE = 1.18;
const MOTION = { duration: 420, easing: Easing.inOut(Easing.cubic) };

export function VyzeHeader() {
  const mode = useVyzeVisualMode();
  const listening = useVyzeStore((state) => state.listening);
  const reply = useVyzeStore((state) => state.reply);
  const lastHeard = useVyzeStore((state) => state.lastHeard);
  const connected = useVyzeStore((state) => state.connected);
  const [rowWidth, setRowWidth] = useState(0);
  const focus = useSharedValue(0);

  useEffect(() => {
    focus.value = withTiming(listening ? 1 : 0, MOTION);
  }, [focus, listening]);

  const orbStyle = useAnimatedStyle(() => {
    const centerX = Math.max(0, rowWidth / 2 - ORB_BOX / 2);
    return {
      transform: [
        { translateX: interpolate(focus.value, [0, 1], [0, centerX]) },
        { scale: interpolate(focus.value, [0, 1], [1, LISTEN_SCALE]) },
      ],
      zIndex: 2,
    };
  });

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focus.value, [0, 0.4], [1, 0]),
    transform: [{ translateX: interpolate(focus.value, [0, 1], [0, 16]) }],
  }));

  const metaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(focus.value, [0, 0.35], [1, 0]),
  }));

  const waveStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
  }));

  const rowStyle = {
    minHeight: ORB_BOX * LISTEN_SCALE + 8,
  };

  return (
    <View className="mx-5 mt-4 overflow-hidden rounded-[28px] border border-white/10">
      <LinearGradient
        colors={['rgba(37, 99, 235, 0.28)', 'rgba(17, 24, 39, 0.96)', 'rgba(8, 18, 32, 0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}
      >
        <Animated.View
          onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
          className="flex-row items-center"
          style={rowStyle}
        >
          <Animated.View style={orbStyle}>
            <VyzeOrb size={ORB_SIZE} mode={mode} />
          </Animated.View>
          <Animated.View pointerEvents={listening ? 'none' : 'auto'} className="ml-1 flex-1 pr-1" style={textStyle}>
            <Text className="text-[11px] font-semibold uppercase tracking-[2px] text-vibx-accent">
              Vyze
            </Text>
            <Text className="mt-1 text-[22px] font-bold tracking-tight text-vibx-text">
              {greetingForNow()}
            </Text>
            <Text className="mt-1 text-sm leading-5 text-vibx-muted" numberOfLines={2}>
              {reply}
            </Text>
            {lastHeard ? (
              <Text className="mt-1 text-xs text-vibx-accent" numberOfLines={1}>
                Heard: {lastHeard}
              </Text>
            ) : (
              <Text className="mt-1 text-xs text-vibx-muted">Feel the music. I&apos;m with you.</Text>
            )}
          </Animated.View>
        </Animated.View>

        <View style={{ height: 30, marginTop: 8, overflow: 'hidden' }}>
          <Animated.View style={waveStyle}>
            <VyzeWaveform active={listening} height={26} />
          </Animated.View>
        </View>

        <View className="mt-3">
          <VyzeHoldButton openPanelOnRelease={false} />
        </View>

        <Animated.View style={metaStyle}>
          <Text className="mt-2 text-center text-[11px] text-white/35">
            {connected ? 'Local assistant ready' : 'Working offline — local commands only'}
          </Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

export const VyzeAssistant = VyzeHeader;
