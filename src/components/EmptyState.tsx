import { Text, View } from 'react-native';

type Props = {
  title: string;
  subtitle?: string;
};

export function EmptyState({ title, subtitle }: Props) {
  return (
    <View className="items-center px-10 py-16">
      <Text className="text-center text-base font-semibold text-vibx-text">{title}</Text>
      {subtitle ? (
        <Text className="mt-2 text-center text-sm leading-5 text-vibx-muted">{subtitle}</Text>
      ) : null}
    </View>
  );
}
