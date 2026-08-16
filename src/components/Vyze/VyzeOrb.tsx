import { memo, useEffect } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import type { VyzeMode } from '@/src/stores/vyzeStore';

type Expression = 'round' | 'slit' | 'smile' | 'dots' | 'off';

type Props = {
  size?: number;
  mode?: VyzeMode;
  compact?: boolean;
};

const GLOW = '#3B82F6';
const SKY = '#7DD3FC';
const ICE = '#E0F2FE';

function expressionFor(mode: VyzeMode): Expression {
  switch (mode) {
    case 'listening':
      return 'round';
    case 'processing':
      return 'dots';
    case 'responding':
      return 'smile';
    case 'music':
      return 'smile';
    case 'sleep':
      return 'off';
    default:
      return 'round';
  }
}

function centerLayer(box: number, dim: number) {
  return {
    position: 'absolute' as const,
    top: (box - dim) / 2,
    left: (box - dim) / 2,
    width: dim,
    height: dim,
  };
}

export const VyzeOrb = memo(function VyzeOrb({ size = 88, mode = 'idle', compact = false }: Props) {
  const floatY = useSharedValue(0);
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.35);
  const lookX = useSharedValue(0);
  const blink = useSharedValue(0);
  const ring = useSharedValue(0);
  const orbit = useSharedValue(0);
  const beat = useSharedValue(0);
  const smile = useSharedValue(mode === 'responding' || mode === 'music' ? 1 : 0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-size * 0.045, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(size * 0.045, { duration: 1800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    return () => cancelAnimation(floatY);
  }, [floatY, size]);

  useEffect(() => {
    const listening = mode === 'listening';
    const processing = mode === 'processing';
    const music = mode === 'music';
    const responding = mode === 'responding';

    pulse.value = withTiming(listening || music || responding ? 1.06 : 1, { duration: 140 });
    glow.value = withTiming(listening ? 0.7 : music ? 0.62 : processing ? 0.5 : 0.32, { duration: 140 });
    smile.value = withTiming(responding || music ? 1 : 0, { duration: 120 });

    if (listening) {
      ring.value = 0;
      ring.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
    } else {
      cancelAnimation(ring);
      ring.value = withTiming(0, { duration: 240 });
    }

    if (processing) {
      orbit.value = 0;
      orbit.value = withRepeat(withTiming(360, { duration: 2200, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(orbit);
      orbit.value = withTiming(0, { duration: 240 });
    }

    if (music) {
      beat.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
          withTiming(0.2, { duration: 320, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      );
    } else if (responding) {
      beat.value = withSequence(withTiming(1, { duration: 180 }), withTiming(0, { duration: 500 }));
    } else {
      cancelAnimation(beat);
      beat.value = withTiming(0, { duration: 240 });
    }

    if (mode !== 'idle') {
      lookX.value = withTiming(0, { duration: 280 });
    }
  }, [mode, beat, glow, lookX, orbit, pulse, ring, smile]);

  useEffect(() => {
    if (mode !== 'idle') return;
    let lookTimer: ReturnType<typeof setTimeout>;
    let blinkTimer: ReturnType<typeof setTimeout>;

    const lookAround = () => {
      const next = ([-1, -0.4, 0, 0, 0.4, 1] as const)[Math.floor(Math.random() * 6)];
      lookX.value = withTiming(next, { duration: 420, easing: Easing.inOut(Easing.quad) });
      lookTimer = setTimeout(lookAround, 2400 + Math.random() * 2200);
    };

    const doBlink = () => {
      blink.value = withSequence(
        withTiming(1, { duration: 70 }),
        withDelay(40, withTiming(0, { duration: 90 }))
      );
      blinkTimer = setTimeout(doBlink, 3000 + Math.random() * 2200);
    };

    lookTimer = setTimeout(lookAround, 1600);
    blinkTimer = setTimeout(doBlink, 1800);
    return () => {
      clearTimeout(lookTimer);
      clearTimeout(blinkTimer);
    };
  }, [blink, lookX, mode]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }, { scale: pulse.value + beat.value * 0.06 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value + beat.value * 0.25,
    transform: [{ scale: 1 + beat.value * 0.08 }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ring.value, [0, 0.15, 1], [0, 0.7, 0]),
    transform: [{ scale: interpolate(ring.value, [0, 1], [0.92, 1.38]) }],
  }));

  const ringTwoStyle = useAnimatedStyle(() => {
    const delayed = Math.max(0, ring.value - 0.28);
    return {
      opacity: interpolate(delayed, [0, 0.2, 0.72], [0, 0.45, 0]),
      transform: [{ scale: interpolate(delayed, [0, 0.72], [0.95, 1.5]) }],
    };
  });

  const orbitStyle = useAnimatedStyle(() => ({
    opacity: interpolate(orbit.value, [0, 8, 20], [0, 1, 1]),
    transform: [{ rotate: `${orbit.value}deg` }],
  }));

  const bassStyle = useAnimatedStyle(() => ({
    opacity: beat.value * 0.55,
    transform: [{ scale: 1 + beat.value * 0.18 }],
  }));

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lookX.value * size * 0.08 }],
  }));

  const pad = compact ? size * 0.22 : size * 0.34;
  const box = size + pad * 2;
  const expression = expressionFor(mode);
  const showMusic = mode === 'music' && !compact;
  const showListenWaves = mode === 'listening' && !compact;
  const glowDim = size * 1.28;
  const ringDim = size * 1.08;
  const bassDim = size * 1.16;
  const orbitDim = size + 16;
  const coreDim = size * 0.62;

  return (
    <Animated.View style={[{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }, wrapStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[centerLayer(box, glowDim), { borderRadius: glowDim / 2, backgroundColor: GLOW }, glowStyle]}
      />

      {mode === 'listening' || mode === 'responding' ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              centerLayer(box, ringDim),
              { borderRadius: ringDim / 2, borderWidth: 1.5, borderColor: SKY },
              ringStyle,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              centerLayer(box, ringDim),
              { borderRadius: ringDim / 2, borderWidth: 1.5, borderColor: GLOW },
              ringTwoStyle,
            ]}
          />
        </>
      ) : null}

      {mode === 'processing' ? (
        <Animated.View pointerEvents="none" style={[centerLayer(box, orbitDim), orbitStyle]}>
          <View
            style={{
              width: orbitDim,
              height: orbitDim,
              borderRadius: orbitDim / 2,
              borderWidth: 2,
              borderColor: 'transparent',
              borderTopColor: SKY,
              borderRightColor: GLOW,
            }}
          />
          {[0, 120, 240].map((deg) => (
            <View
              key={deg}
              style={{
                position: 'absolute',
                width: orbitDim,
                height: orbitDim,
                transform: [{ rotate: `${deg}deg` }],
              }}
            >
              <View
                style={{
                  alignSelf: 'center',
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: ICE,
                }}
              />
            </View>
          ))}
        </Animated.View>
      ) : null}

      {showMusic ? <MusicHalo size={size} box={box} beat={beat} /> : null}

      <Animated.View
        pointerEvents="none"
        style={[
          centerLayer(box, bassDim),
          { borderRadius: bassDim / 2, borderWidth: 4, borderColor: GLOW },
          bassStyle,
        ]}
      />

      {showListenWaves ? <SideWaves size={size} box={box} active /> : null}

      <LinearGradient
        colors={['#1F2937', '#111827', '#0B1220']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: 'rgba(125, 211, 252, 0.28)',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: (size - coreDim) / 2,
            left: (size - coreDim) / 2,
            width: coreDim,
            height: coreDim,
            borderRadius: coreDim / 2,
            backgroundColor: 'rgba(37, 99, 235, 0.28)',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: size * 0.1,
            left: size * 0.16,
            width: size * 0.34,
            height: size * 0.18,
            borderRadius: size * 0.12,
            backgroundColor: 'rgba(224, 242, 254, 0.18)',
            transform: [{ rotate: '-18deg' }],
          }}
        />
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, faceStyle]}>
          <Eye size={size} expression={expression} blink={blink} smile={smile} />
          <View style={{ width: size * 0.12 }} />
          <Eye size={size} expression={expression} blink={blink} smile={smile} />
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
});

function Eye({
  size,
  expression,
  blink,
  smile,
}: {
  size: number;
  expression: Expression;
  blink: SharedValue<number>;
  smile: SharedValue<number>;
}) {
  const width = size * 0.14;
  const height = size * 0.14;

  const roundStyle = useAnimatedStyle(() => {
    const closed = blink.value;
    return {
      opacity: expression === 'round' || expression === 'dots' ? 1 - smile.value : 0,
      height: interpolate(closed, [0, 1], [height, Math.max(2, height * 0.14)]),
      transform: [{ scaleX: expression === 'dots' ? 0.92 : 1 }],
    };
  });

  const smileStyle = useAnimatedStyle(() => ({
    opacity: smile.value,
    transform: [{ scale: interpolate(smile.value, [0, 1], [0.7, 1]) }],
  }));

  if (expression === 'off') {
    return (
      <View
        style={{
          width,
          height: 2,
          borderRadius: 1,
          backgroundColor: 'rgba(96, 165, 250, 0.35)',
        }}
      />
    );
  }

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            width,
            borderRadius: width / 2,
            backgroundColor: SKY,
            shadowColor: ICE,
            shadowOpacity: 0.9,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
          },
          roundStyle,
        ]}
      >
        {expression === 'dots' ? (
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', padding: 2 }}>
            {[0, 1, 2, 3].map((dot) => (
              <View
                key={dot}
                style={{
                  width: 2,
                  height: 2,
                  margin: 1,
                  borderRadius: 1,
                  backgroundColor: ICE,
                }}
              />
            ))}
          </View>
        ) : null}
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: width * 1.05,
            height: height * 0.72,
            borderBottomWidth: Math.max(2.5, size * 0.028),
            borderLeftWidth: Math.max(2.5, size * 0.028),
            borderRightWidth: Math.max(2.5, size * 0.028),
            borderColor: SKY,
            borderRadius: width,
            backgroundColor: 'transparent',
          },
          smileStyle,
        ]}
      />
    </View>
  );
}

function SideWaves({ size, box, active }: { size: number; box: number; active: boolean }) {
  return (
    <>
      <WaveColumn size={size} box={box} side="left" active={active} />
      <WaveColumn size={size} box={box} side="right" active={active} />
    </>
  );
}

function WaveColumn({
  size,
  box,
  side,
  active,
}: {
  size: number;
  box: number;
  side: 'left' | 'right';
  active: boolean;
}) {
  const colHeight = size * 0.55;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        [side]: (box - size) / 2 - 10,
        top: (box - colHeight) / 2,
        height: colHeight,
        justifyContent: 'space-between',
      }}
    >
      {[0, 1, 2, 3].map((index) => (
        <WaveBar key={index} delay={index * 90} active={active} />
      ))}
    </View>
  );
}

function WaveBar({ delay, active }: { delay: number; active: boolean }) {
  const scale = useSharedValue(0.4);

  useEffect(() => {
    if (!active) {
      scale.value = withTiming(0.4, { duration: 200 });
      return;
    }
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 280 }), withTiming(0.35, { duration: 280 })),
        -1,
        true
      )
    );
    return () => cancelAnimation(scale);
  }, [active, delay, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
    opacity: 0.35 + scale.value * 0.65,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 3,
          height: 10,
          borderRadius: 2,
          backgroundColor: SKY,
        },
        style,
      ]}
    />
  );
}

function MusicHalo({ size, box, beat }: { size: number; box: number; beat: SharedValue<number> }) {
  const wrap = size * 1.35;
  return (
    <View pointerEvents="none" style={centerLayer(box, wrap)}>
      {Array.from({ length: 12 }, (_, index) => (
        <MusicSpike key={index} index={index} size={size} wrap={wrap} beat={beat} />
      ))}
    </View>
  );
}

function MusicSpike({
  index,
  size,
  wrap,
  beat,
}: {
  index: number;
  size: number;
  wrap: number;
  beat: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const phase = (index % 4) / 4;
    const energy = interpolate(Math.min(beat.value + phase, 1), [0, 1], [0.35, 1]);
    return {
      opacity: 0.25 + energy * 0.7,
      transform: [{ scaleY: 0.7 + energy * 0.85 }],
    };
  });

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: wrap,
        height: wrap,
        transform: [{ rotate: `${index * 30}deg` }],
        alignItems: 'center',
      }}
    >
      <Animated.View
        style={[
          {
            width: 3,
            height: size * 0.2,
            borderRadius: 2,
            backgroundColor: index % 3 === 0 ? ICE : SKY,
          },
          style,
        ]}
      />
    </View>
  );
}
