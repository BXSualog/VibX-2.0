import {
  MINI_PLAYER_HEIGHT,
  MiniPlayer,
} from "@/src/components/MiniPlayer/MiniPlayer";
import { usePlayerStore } from "@/src/stores/playerStore";
import { colors } from "@/src/theme/colors";
import { useActiveMediaItem } from "@rntp/player";
import { usePathname } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const TAB_BUTTONS_HEIGHT = 68;

export function miniPlayerTabOffset(bottomInset: number) {
  return TAB_BUTTONS_HEIGHT + Math.max(bottomInset, 14);
}

export function useNowPlayingVisible() {
  const item = useActiveMediaItem();
  const currentSong = usePlayerStore((state) => state.currentSong);
  return Boolean(item || currentSong);
}

export function MiniPlayerDock() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const visible = useNowPlayingVisible();

  if (!visible || pathname === "/player") return null;

  return (
    <View
      pointerEvents="box-none"
      collapsable={false}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        elevation: 40,
        backgroundColor: colors.background,
        paddingBottom: Math.max(insets.bottom, 10),
      }}
    >
      <MiniPlayer />
    </View>
  );
}

export function MiniPlayerTabSpacer() {
  const visible = useNowPlayingVisible();
  if (!visible) return null;
  return <View style={{ height: MINI_PLAYER_HEIGHT + 6 }} />;
}
