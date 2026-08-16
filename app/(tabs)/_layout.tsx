import { memo, useCallback, type ReactNode } from "react";
import { MINI_PLAYER_HEIGHT } from "@/src/components/MiniPlayer/MiniPlayer";
import { MiniPlayerTabSpacer } from "@/src/components/MiniPlayer/MiniPlayerDock";
import { VyzeFab } from "@/src/components/Vyze/VyzeFab";
import { VyzePanel } from "@/src/components/Vyze/VyzePanel";
import { VyzeQueue } from "@/src/components/Vyze/VyzeQueue";
import { useVyzeStore } from "@/src/stores/vyzeStore";
import { colors } from "@/src/theme/colors";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, Text, View, type ColorValue } from "react-native";
import { useActiveMediaItem } from "@rntp/player";

const tabScreenOptions = {
  headerShown: false,
  lazy: true,
  freezeOnBlur: true,
  animation: "none" as const,
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.muted,
  sceneStyle: { backgroundColor: colors.background },
};

type TabIconProps = { color: ColorValue; focused: boolean; size: number };

function HomeTabIcon({ color }: TabIconProps) {
  return (
    <SymbolView
      name={{ ios: "house.fill", android: "home", web: "home" }}
      tintColor={color as string}
      size={22}
    />
  );
}

function LibraryTabIcon({ color }: TabIconProps) {
  return (
    <SymbolView
      name={{
        ios: "square.stack.fill",
        android: "library_music",
        web: "library_music",
      }}
      tintColor={color as string}
      size={22}
    />
  );
}

function DownloadsTabIcon({ color }: TabIconProps) {
  return (
    <SymbolView
      name={{
        ios: "arrow.down.circle.fill",
        android: "download",
        web: "download",
      }}
      tintColor={color as string}
      size={22}
    />
  );
}

function ProfileTabIcon({ color }: TabIconProps) {
  return (
    <SymbolView
      name={{
        ios: "person.crop.circle.fill",
        android: "person",
        web: "person",
      }}
      tintColor={color as string}
      size={22}
    />
  );
}

const TabButton = memo(function TabButton({
  focused,
  color,
  title,
  icon,
  onPress,
}: {
  focused: boolean;
  color: string;
  title?: string;
  icon?: (props: TabIconProps) => ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable className="flex-1 items-center" onPress={onPress}>
      <View
        className={`h-10 w-14 items-center justify-center rounded-full ${
          focused ? "bg-vibx-primary/20" : ""
        }`}
      >
        {icon?.({ color, focused, size: 22 })}
      </View>
      <Text
        style={{ color }}
        className={`mt-1 text-[10px] ${focused ? "font-bold" : "font-medium"}`}
      >
        {title}
      </Text>
    </Pressable>
  );
});

const VibxTabBar = memo(function VibxTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: any) {
  const onTabPress = useCallback(
    (route: { key: string; name: string }, focused: boolean) => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
      requestAnimationFrame(() => {
        void Haptics.selectionAsync();
      });
    },
    [navigation],
  );

  const playingItem = useActiveMediaItem();
  const fabTop = playingItem ? -(MINI_PLAYER_HEIGHT + 28) : -100;

  return (
    <View className="bg-vibx-bg">
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", right: 10, top: fabTop, zIndex: 30 }}
      >
        <VyzeFab />
      </View>
      <MiniPlayerTabSpacer />
      <View
        className="flex-row border-t border-white/5 bg-vibx-bg pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 14) }}
      >
        {state.routes.map(
          (route: { key: string; name: string }, index: number) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const color = focused ? colors.accent : colors.muted;
            return (
              <TabButton
                key={route.key}
                focused={focused}
                color={color}
                title={options.title}
                icon={options.tabBarIcon}
                onPress={() => onTabPress(route, focused)}
              />
            );
          },
        )}
      </View>
    </View>
  );
});

function renderTabBar(props: any) {
  return <VibxTabBar {...props} />;
}

function ActiveVyzePanel() {
  const open = useVyzeStore((state) => state.panelOpen);
  return (
    <>
      {open ? <VyzePanel /> : null}
      <VyzeQueue />
    </>
  );
}

export default function TabLayout() {
  return (
    <>
      <Tabs
        tabBar={renderTabBar}
        detachInactiveScreens={false}
        screenOptions={tabScreenOptions}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: HomeTabIcon,
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: LibraryTabIcon,
          }}
        />
        <Tabs.Screen
          name="downloads"
          options={{
            title: "Downloads",
            tabBarIcon: DownloadsTabIcon,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ProfileTabIcon,
          }}
        />
      </Tabs>
      <ActiveVyzePanel />
    </>
  );
}
