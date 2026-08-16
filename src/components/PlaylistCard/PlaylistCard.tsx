import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { colors } from '@/src/theme/colors';
import { playlistCover } from '@/src/utils/cover';
import { isLockedPlaylist } from '@/src/constants/playlists';

type Props = {
  id: string;
  name: string;
  count?: number;
  size?: number;
  locked?: number;
  onPress?: () => void;
};

export function PlaylistCard({ id, name, count, size = 140, locked = 0, onPress }: Props) {
  const { palette } = playlistCover(id, name);
  const tabWidth = size * 0.44;
  const tabHeight = size * 0.16;
  const bodyHeight = size * 0.8;

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      className="active:opacity-85"
      style={{ width: size }}
    >
      <View style={{ width: size, height: size }}>
        <View
          style={{
            position: 'absolute',
            left: size * 0.08,
            top: size * 0.02,
            width: tabWidth,
            height: tabHeight,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 14,
            backgroundColor: palette[0],
          }}
        />
        <LinearGradient
          colors={[palette[0], palette[1], palette[2]]}
          locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: bodyHeight,
            borderRadius: 18,
            borderTopLeftRadius: 8,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.22)',
          }}
        >
          <LinearGradient
            colors={['transparent', palette[2], palette[0]]}
            locations={[0.15, 0.62, 1]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View
            className="items-center justify-center bg-black/20"
            style={{
              height: size * 0.34,
              width: size * 0.34,
              borderRadius: size * 0.1,
            }}
          >
            <SymbolView
              name={{ ios: 'music.note', android: 'music_note', web: 'music_note' }}
              tintColor={colors.vyzeIce}
              size={Math.round(size * 0.2)}
            />
          </View>
        </LinearGradient>
      </View>
      <View className="mt-2.5">
        <Text className="text-[15px] font-semibold tracking-tight text-vibx-text" numberOfLines={1}>
          {name}
        </Text>
        <Text className="mt-0.5 text-xs text-vibx-muted">
          {isLockedPlaylist({ id, locked }) ? 'Default · ' : ''}
          {count ?? 0} {count === 1 ? 'song' : 'songs'}
        </Text>
      </View>
    </Pressable>
  );
}
