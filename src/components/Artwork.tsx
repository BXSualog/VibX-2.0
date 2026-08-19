import { colors } from "@/src/theme/colors";
import { initials } from "@/src/utils/format";
import { Image } from "expo-image";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  uri?: string | null;
  title: string;
  artist?: string;
  size?: number;
  rounded?: number;
};

export const Artwork = memo(function Artwork({
  uri,
  title,
  artist,
  size = 56,
  rounded = 12,
}: Props) {
  const frame = {
    width: size,
    height: size,
    borderRadius: rounded,
  };

  if (uri && typeof uri === "string" && !/^https?:\/\/\s*$/i.test(uri)) {
    return (
      <Image
        source={{ uri, width: size * 2, height: size * 2 }}
        style={[styles.frame, frame]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={uri}
        priority="low"
        transition={0}
      />
    );
  }

  return (
    <View style={[styles.frame, styles.placeholder, frame]}>
      <Text style={[styles.initials, { fontSize: Math.max(12, size * 0.28) }]}>
        {initials(title, artist)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    flexShrink: 0,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  initials: {
    fontWeight: "700",
    color: colors.accent,
  },
});
