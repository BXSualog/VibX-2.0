import { Text, View } from 'react-native';

type Props = {
  title: string;
  action?: string;
};

export function SectionHeader({ title, action }: Props) {
  return (
    <View className="mb-3 mt-7 flex-row items-end justify-between px-5">
      <Text className="text-[22px] font-bold tracking-tight text-vibx-text">{title}</Text>
      {action ? <Text className="text-sm font-semibold text-vibx-accent">{action}</Text> : null}
    </View>
  );
}
