import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/src/theme/colors';

export const AZ_LETTER_HEADER_HEIGHT = 48;

export const AzLetterHeader = memo(function AzLetterHeader({ letter }: { letter: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.letter}>{letter}</Text>
      <View style={styles.line} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    height: AZ_LETTER_HEADER_HEIGHT,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  letter: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.accent,
  },
  line: {
    marginTop: 8,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
