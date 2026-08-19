import '../global.css';

import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';
import 'react-native-reanimated';

import { colors } from '@/src/theme/colors';
import { useBootstrap } from '@/src/hooks/useBootstrap';

enableFreeze(true);

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    primary: colors.primary,
    text: colors.text,
    border: colors.elevated,
    notification: colors.highlight,
  },
};

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  useBootstrap();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="search"
            options={{
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="browse"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="catalog-album"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="catalog-artist"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="album"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="player"
            options={{
              presentation: 'transparentModal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
