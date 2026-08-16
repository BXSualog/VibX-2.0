import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useVyzeStore } from '@/src/stores/vyzeStore';

type Props = {
  bars?: number;
  height?: number;
  active?: boolean;
  color?: string;
};

const FLAT = 0.08;
const FOLLOW = { duration: 70, easing: Easing.out(Easing.quad) };
const SETTLE = { duration: 140, easing: Easing.out(Easing.cubic) };

function barTarget(index: number, count: number, level: number, frequency: number, active: boolean) {
  if (!active || level <= 0.015) return FLAT;

  const t = count <= 1 ? 0.5 : index / (count - 1);
  const formant =
    0.58 * Math.exp(-((t - 0.5) ** 2) / 0.09) +
    0.34 * (1 - frequency) * Math.exp(-((t - 0.2) ** 2) / 0.048) +
    0.42 * frequency * Math.exp(-((t - 0.7) ** 2) / 0.042);
  const cycles = 1.15 + frequency * 2.7;
  const wave = 0.36 + 0.64 * Math.abs(Math.sin(Math.PI * (t * cycles + frequency * 0.4 + level * 0.18)));
  const detune = 1 - 0.14 * (index % 2) * (1 - frequency);

  return Math.min(1, Math.max(FLAT, FLAT + level * (0.12 + 0.88 * formant * wave * detune)));
}

export function VyzeWaveform({ bars = 18, height = 28, active = true, color = '#7DD3FC' }: Props) {
  const level = useVyzeStore((state) => state.voiceLevel);
  const frequency = useVyzeStore((state) => state.voiceFrequency);

  return (
    <View className="flex-row items-center justify-center" style={{ height, gap: 3 }}>
      {Array.from({ length: bars }, (_, index) => (
        <Bar
          key={index}
          index={index}
          bars={bars}
          maxHeight={height}
          active={active}
          color={color}
          level={level}
          frequency={frequency}
        />
      ))}
    </View>
  );
}

function Bar({
  index,
  bars,
  maxHeight,
  active,
  color,
  level,
  frequency,
}: {
  index: number;
  bars: number;
  maxHeight: number;
  active: boolean;
  color: string;
  level: number;
  frequency: number;
}) {
  const scale = useSharedValue(FLAT);

  useEffect(() => {
    const target = barTarget(index, bars, level, frequency, active);
    cancelAnimation(scale);
    scale.value = withTiming(target, target <= FLAT + 0.02 ? SETTLE : FOLLOW);
  }, [active, bars, frequency, index, level, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
    opacity: 0.38 + scale.value * 0.62,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 3,
          height: maxHeight,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
