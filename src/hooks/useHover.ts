import { useCallback } from "react";
import {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export const ROW_HOVER_BG = "rgba(255,255,255,0.12)";
export const ROW_PRESS_BG = "rgba(255,255,255,0.18)";

const HOVER_ALPHA = 0.12;
const PRESS_ALPHA = 0.18;
const HOVER_MS = 140;
const CLICK_MS = 55;
const EASE = Easing.out(Easing.quad);

export function useRowHighlight() {
  const alpha = useSharedValue(0);
  const hovered = useSharedValue(0);
  const pressed = useSharedValue(0);

  const fadeTo = useCallback(
    (value: number, duration: number) => {
      alpha.value = withTiming(value, { duration, easing: EASE });
    },
    [alpha],
  );

  const restAlpha = useCallback(
    () => (hovered.value ? HOVER_ALPHA : 0),
    [hovered],
  );

  const onHoverIn = useCallback(() => {
    hovered.value = 1;
    fadeTo(pressed.value ? PRESS_ALPHA : HOVER_ALPHA, HOVER_MS);
  }, [fadeTo, hovered, pressed]);

  const onHoverOut = useCallback(() => {
    hovered.value = 0;
    fadeTo(pressed.value ? PRESS_ALPHA : 0, HOVER_MS);
  }, [fadeTo, hovered, pressed]);

  const onPressIn = useCallback(() => {
    pressed.value = 1;
    fadeTo(PRESS_ALPHA, CLICK_MS);
  }, [fadeTo, pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = 0;
    fadeTo(restAlpha(), CLICK_MS);
  }, [fadeTo, pressed, restAlpha]);

  const highlightStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      alpha.value,
      [0, HOVER_ALPHA, PRESS_ALPHA],
      ["rgba(255,255,255,0)", ROW_HOVER_BG, ROW_PRESS_BG],
    ),
  }));

  return {
    highlightStyle,
    pressProps: {
      unstable_pressDelay: 0,
      onHoverIn,
      onHoverOut,
      onPointerEnter: onHoverIn,
      onPointerLeave: onHoverOut,
      onPressIn,
      onPressOut,
    },
  };
}
