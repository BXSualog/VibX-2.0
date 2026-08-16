import { memo } from 'react';
import { View } from 'react-native';
import { usePathname } from 'expo-router';
import { VyzeHoldButton } from '@/src/components/Vyze/VyzeHoldButton';
import { VyzeOrb } from '@/src/components/Vyze/VyzeOrb';
import { useVyzeVisualMode } from '@/src/components/Vyze/useVyzeVisualMode';
import { useVyzeStore } from '@/src/stores/vyzeStore';

export const VyzeFab = memo(function VyzeFab() {
  const pathname = usePathname();
  const mode = useVyzeVisualMode();
  const panelOpen = useVyzeStore((state) => state.panelOpen);
  const setPanelOpen = useVyzeStore((state) => state.setPanelOpen);

  if (panelOpen || pathname === '/player') return null;

  return (
    <View
      style={{
        shadowColor: '#3B82F6',
        shadowOpacity: 0.55,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      }}
    >
      <VyzeHoldButton openPanelOnRelease={false} onShortPress={() => setPanelOpen(true)}>
        <VyzeOrb size={54} mode={mode} compact />
      </VyzeHoldButton>
    </View>
  );
});
