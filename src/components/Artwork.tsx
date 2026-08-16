import { colors } from "@/src/theme/colors";
import { initials } from "@/src/utils/format";
import { Image } from "expo-image";
import { memo } from "react";
import { Text, View } from "react-native";

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
  const style = {
    width: size,
    height: size,
    borderRadius: rounded,
    backgroundColor: colors.elevated,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    overflow: "hidden" as const,
    flexShrink: 0,
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={style}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={uri}
        transition={0}
      />
    );
  }

  return (
    <View className="items-center justify-center" style={style}>
      <Text
        className="font-bold text-vibx-accent"
        style={{ fontSize: Math.max(12, size * 0.28) }}
      >
        {initials(title, artist)}
      </Text>
    </View>
  );
});
