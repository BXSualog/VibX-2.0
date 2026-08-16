import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/src/components/EmptyState';

export default function DownloadsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-vibx-bg" edges={['top']}>
      <LinearGradient
        colors={['rgba(37, 99, 235, 0.16)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180 }}
      />
      <View className="flex-1">
        <Text className="px-5 pt-3 text-[34px] font-bold tracking-tight text-vibx-text">Downloads</Text>
        <EmptyState title="Coming soon" subtitle="Downloaded tracks from the catalog will appear here." />
      </View>
    </SafeAreaView>
  );
}
