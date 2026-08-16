import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { colors } from '@/src/theme/colors';
import { coverPalette } from '@/src/utils/cover';
import { initials } from '@/src/utils/format';

type Props = {
  title: string;
  subtitle: string;
  artwork?: string | null;
  count?: number;
  size?: number;
  onPress?: () => void;
};

export const AlbumCard = memo(function AlbumCard({ title, subtitle, artwork, count, size = 152, onPress }: Props) {
  const palette = coverPalette(title, subtitle);
  const handlePress = useCallback(() => {
    void Haptics.selectionAsync();
    onPress?.();
  }, [onPress]);

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.press, { opacity: pressed ? 0.88 : 1, width: size }]}>
      <View style={{ width: size, height: size }}>
        <View
          pointerEvents="none"
          style={[
            styles.vinyl,
            {
              right: -7,
              top: 8,
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: Math.max(8, size * 0.055),
            },
          ]}
        />
        <View style={[styles.cover, { width: size, height: size, backgroundColor: palette[0] }]}>
          {artwork ? (
            <Image
              source={{ uri: artwork }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={artwork}
              transition={0}
            />
          ) : (
            <View style={styles.fallback}>
              <Text style={[styles.initials, { fontSize: size * 0.22 }]}>{initials(title, subtitle)}</Text>
            </View>
          )}
          <View style={styles.scrim} />
        </View>
        <View style={styles.play}>
          <SymbolView
            name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
            tintColor={colors.background}
            size={16}
          />
        </View>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title || 'Unknown album'}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {subtitle}
        {typeof count === 'number' ? ` · ${count} ${count === 1 ? 'song' : 'songs'}` : ''}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  press: {
    alignSelf: 'flex-start',
  },
  vinyl: {
    position: 'absolute',
    backgroundColor: '#0B1220',
    borderColor: '#1F2937',
  },
  cover: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    backgroundColor: 'rgba(8, 18, 32, 0.42)',
  },
  play: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    height: 34,
    width: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.94)',
  },
  title: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.muted,
  },
});
