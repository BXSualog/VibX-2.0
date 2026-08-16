import { useCallback, useState } from "react";

export const ROW_HOVER_BG = "rgba(255,255,255,0.12)";
export const ROW_PRESS_BG = "rgba(255,255,255,0.22)";

export function useRowHighlight() {
  const [hovered, setHovered] = useState(false);
  const [held, setHeld] = useState(false);

  const onHoverIn = useCallback(() => setHovered(true), []);
  const onHoverOut = useCallback(() => setHovered(false), []);
  const onHoldStart = useCallback(() => setHeld(true), []);
  const onHoldEnd = useCallback(() => setHeld(false), []);

  return {
    highlight: {
      backgroundColor: held
        ? ROW_PRESS_BG
        : hovered
          ? ROW_HOVER_BG
          : "transparent",
    },
    pressProps: {
      delayPressIn: 0,
      onHoverIn,
      onHoverOut,
      onPressIn: onHoldStart,
      onPressOut: onHoldEnd,
      onTouchStart: onHoldStart,
      onTouchEnd: onHoldEnd,
      onTouchCancel: onHoldEnd,
    },
  };
}
