import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/src/theme/colors';

const BAR_PEAKS = [0.48, 1, 0.64, 0.86];

export const SoundWave = memo(function SoundWave() {
  return (
    <View style={styles.wave}>
      {BAR_PEAKS.map((peak, index) => (
        <WaveBar key={index} index={index} peak={peak} />
      ))}
    </View>
  );
});

export const PlayingIndicator = memo(function PlayingIndicator() {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Playing</Text>
      <SoundWave />
    </View>
  );
});

function WaveBar({ index, peak }: { index: number; peak: number }) {
  const scale = useSharedValue(0.28);

  useEffect(() => {
    scale.value = withDelay(
      index * 70,
      withRepeat(
        withSequence(
          withTiming(peak, { duration: 260 + (index % 3) * 40 }),
          withTiming(0.28, { duration: 260 + (index % 2) * 40 }),
        ),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(scale);
  }, [index, peak, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return <Animated.View style={[styles.bar, style]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
  },
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 14,
    gap: 2,
  },
  bar: {
    width: 2.5,
    height: 14,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
  },
});
