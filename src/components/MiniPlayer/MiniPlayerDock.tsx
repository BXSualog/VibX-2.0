import { View } from "react-native";
import { useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveMediaItem } from "@rntp/player";
import { MiniPlayer, MINI_PLAYER_HEIGHT } from "@/src/components/MiniPlayer/MiniPlayer";

export const TAB_BUTTONS_HEIGHT = 68;

export function miniPlayerTabOffset(bottomInset: number) {
  return TAB_BUTTONS_HEIGHT + Math.max(bottomInset, 14);
}

export function MiniPlayerDock() {
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const item = useActiveMediaItem();
  const onPlayer = segments.includes("player");
  const onAlbum = segments.includes("album");
  const onSearch = segments.includes("search");

  if (!item || onPlayer) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: onAlbum || onSearch ? Math.max(insets.bottom, 10) : miniPlayerTabOffset(insets.bottom),
        zIndex: 40,
      }}
    >
      <MiniPlayer />
    </View>
  );
}

export function MiniPlayerTabSpacer() {
  const item = useActiveMediaItem();
  if (!item) return null;
  return <View style={{ height: MINI_PLAYER_HEIGHT + 6 }} />;
}
