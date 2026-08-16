import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDownloadStore } from '@/src/stores/downloadStore';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { formatBytes } from '@/src/utils/format';

export default function ProfileScreen() {
  const songs = useLibraryStore((state) => state.songs);
  const importFiles = useDownloadStore((state) => state.importFiles);
  const busy = useDownloadStore((state) => state.busy);
  const message = useDownloadStore((state) => state.message);
  const storageBytes = useDownloadStore((state) => state.storageBytes);
  const refreshStorage = useDownloadStore((state) => state.refreshStorage);

  return (
    <SafeAreaView className="flex-1 bg-vibx-bg" edges={['top']}>
      <LinearGradient
        colors={['rgba(37, 99, 235, 0.16)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180 }}
      />
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-3">
        <Text className="text-[34px] font-bold tracking-tight text-vibx-text">Profile</Text>
        <View className="mb-6 mt-5 flex-row items-center">
          <LinearGradient
            colors={['#2563EB', '#1E3A8A']}
            style={{ height: 64, width: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text className="text-xl font-bold text-white">VX</Text>
          </LinearGradient>
          <View className="ml-4">
            <Text className="text-xl font-bold text-vibx-text">VibX 2.0 Listener</Text>
            <Text className="mt-0.5 text-sm text-vibx-muted">Offline-first music player</Text>
          </View>
        </View>

        <View className="overflow-hidden rounded-3xl border border-white/5 bg-vibx-surface px-5">
          <Row title="Theme" value="VibX 2.0 Midnight" />
          <Row title="Audio quality" value="Original file" />
          <Row title="Tracks in library" value={String(songs.length)} />
          <Row title="Storage" value={formatBytes(storageBytes)} last />
        </View>

        <Pressable
          disabled={busy}
          onPress={() => {
            refreshStorage();
            void importFiles();
          }}
          className={`mt-5 items-center rounded-2xl bg-vibx-primary py-3.5 ${busy ? 'opacity-70' : ''}`}
        >
          <Text className="font-semibold text-white">
            {busy ? 'Importing…' : 'Import local music'}
          </Text>
        </Pressable>
        {message ? <Text className="mt-3 text-center text-sm text-vibx-muted">{message}</Text> : null}

        <View className="mt-6 rounded-3xl border border-white/5 bg-vibx-surface p-5">
          <Text className="text-lg font-bold text-vibx-text">About VibX 2.0</Text>
          <Text className="mt-2 text-sm leading-6 text-vibx-muted">
            VibX 2.0 Phase 1 is an offline-first music player. Browse your local library, play in the
            background, and control playback with Vyze. Online catalog, Deezer previews, and Whisper
            arrive in later phases.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ title, value, last }: { title: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row items-center justify-between py-4 ${last ? '' : 'border-b border-white/5'}`}>
      <Text className="text-vibx-text">{title}</Text>
      <Text className="text-vibx-muted">{value}</Text>
    </View>
  );
}
