import type { Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors } from '@/src/theme/colors';

const BAR_HEIGHT = 48;

type Props = {
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  onPress?: () => void;
  inputRef?: Ref<TextInput>;
};

export function SearchBar({
  value = '',
  onChangeText,
  placeholder = 'Search songs, albums, playlists',
  onPress,
  inputRef,
}: Props) {
  const bar = (
    <View style={styles.bar}>
      <SymbolView
        name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
        tintColor={colors.muted}
        size={18}
      />
      {onPress ? (
        <Text style={styles.placeholder} numberOfLines={1}>
          {placeholder}
        </Text>
      ) : (
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={false}
          returnKeyType="search"
          underlineColorAndroid="transparent"
        />
      )}
      {!onPress && value.length > 0 ? (
        <Pressable onPress={() => onChangeText?.('')} hitSlop={10} style={styles.clear}>
          <SymbolView
            name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
            tintColor={colors.muted}
            size={18}
          />
        </Pressable>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className="mx-5 mt-4">
        {bar}
      </Pressable>
    );
  }

  return <View className="mx-5 mt-4">{bar}</View>;
}

const styles = StyleSheet.create({
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: colors.elevated,
    paddingHorizontal: 16,
  },
  placeholder: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    lineHeight: 20,
    color: colors.muted,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    height: BAR_HEIGHT,
    paddingVertical: 0,
    fontSize: 16,
    lineHeight: 20,
    color: colors.text,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  clear: {
    paddingLeft: 8,
  },
});
