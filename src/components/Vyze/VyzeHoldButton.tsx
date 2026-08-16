import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { useVyzeStore } from '@/src/stores/vyzeStore';

const HOLD_MS = 280;

type Props = {
  children?: ReactNode;
  label?: string;
  openPanelOnRelease?: boolean;
  onShortPress?: () => void;
};

export function VyzeHoldButton({
  children,
  label = 'Hold to talk',
  openPanelOnRelease = false,
  onShortPress,
}: Props) {
  const listening = useVyzeStore((state) => state.listening);
  const startListening = useVyzeStore((state) => state.startListening);
  const stopListening = useVyzeStore((state) => state.stopListening);
  const finishListening = useVyzeStore((state) => state.finishListening);
  const holdStarted = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceArmed = useRef(false);
  const waitForHold = Boolean(onShortPress);

  function clearHoldTimer() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function beginListening() {
    voiceArmed.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void startListening();
  }

  useEffect(() => () => clearHoldTimer(), []);

  return (
    <Pressable
      accessibilityLabel={listening ? 'Listening' : 'Hold Vyze to talk'}
      onPressIn={() => {
        holdStarted.current = Date.now();
        voiceArmed.current = false;
        clearHoldTimer();
        if (waitForHold) {
          holdTimer.current = setTimeout(beginListening, HOLD_MS);
          return;
        }
        beginListening();
      }}
      onPressOut={() => {
        const elapsed = Date.now() - holdStarted.current;
        const held = elapsed >= HOLD_MS;
        clearHoldTimer();
        if (!held) {
          if (voiceArmed.current) stopListening(false);
          voiceArmed.current = false;
          onShortPress?.();
          return;
        }
        if (openPanelOnRelease) {
          useVyzeStore.getState().setPanelOpen(true);
        }
        void finishListening();
      }}
    >
      {children ?? (
        <LinearGradient
          colors={listening ? ['#3B82F6', '#2563EB'] : ['#1F2937', '#111827']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 22,
            borderWidth: 1,
            borderColor: listening ? 'rgba(125, 211, 252, 0.55)' : 'rgba(255,255,255,0.08)',
          }}
        >
          <View className="flex-row items-center justify-center px-5 py-3.5">
            <SymbolView
              name={{ ios: 'mic.fill', android: 'mic', web: 'mic' }}
              tintColor="#E0F2FE"
              size={18}
            />
            <Text className="ml-2 text-[15px] font-semibold text-white">
              {listening ? 'Listening…' : label}
            </Text>
          </View>
        </LinearGradient>
      )}
    </Pressable>
  );
}
