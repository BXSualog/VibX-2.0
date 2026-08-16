import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Missing', headerShown: true }} />
      <View className="flex-1 items-center justify-center bg-vibx-bg p-6">
        <Text className="text-xl font-bold text-vibx-text">This screen doesn't exist.</Text>
        <Link href="/" className="mt-4">
          <Text className="text-vibx-accent">Go home</Text>
        </Link>
      </View>
    </>
  );
}
