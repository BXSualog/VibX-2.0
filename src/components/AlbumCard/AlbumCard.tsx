import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import { colors } from "@/src/theme/colors";
import { brightCoverPalette } from "@/src/utils/cover";

type Props = {
  title: string;
  subtitle: string;
  artwork?: string | null;
  count?: number;
  size?: number;
  onPress?: () => void;
};

export const AlbumCard = memo(function AlbumCard({
  title,
  subtitle,
  artwork,
  count,
  size = 152,
  onPress,
}: Props) {
  const palette = brightCoverPalette(title, subtitle);
  const handlePress = useCallback(() => {
    void Haptics.selectionAsync();
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, width: size }]}
    >
      <View
        style={[styles.cover, { width: size, height: size, backgroundColor: palette[2] }]}
      >
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
          <LinearGradient
            colors={[palette[0], palette[1], palette[2]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          >
            <View style={styles.fallback}>
              <SymbolView
                name={{ ios: "music.note", android: "album", web: "album" }}
                tintColor="rgba(255,255,255,0.95)"
                size={Math.round(size * 0.34)}
              />
            </View>
          </LinearGradient>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title || "Unknown album"}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {subtitle}
        {typeof count === "number"
          ? ` · ${count} ${count === 1 ? "song" : "songs"}`
          : ""}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  cover: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.muted,
  },
});
