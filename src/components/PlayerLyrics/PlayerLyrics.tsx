import { colors } from '@/src/theme/colors';
import { brightCoverPalette } from '@/src/utils/cover';
import { activeLyricIndex, lyricLeadSeconds, type LyricLine } from '@/src/utils/lrc';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useProgress } from '@rntp/player';

const LINE_HEIGHT = 58;
const RESUME_AUTO_SCROLL_MS = 3500;
const LYRIC_TICK_S = 0.08;

type LyricClock = {
  get: () => number;
  set: (position: number) => void;
  subscribe: (listener: () => void) => () => void;
};

type PreparedLine = LyricLine & {
  words: string[];
  nextTime: number;
};

const LyricClockContext = createContext<LyricClock | null>(null);

function createLyricClock(): LyricClock {
  let position = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => position,
    set: (next) => {
      if (position === next) return;
      position = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function lineWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function litWordCount(
  position: number,
  start: number,
  nextTime: number,
  wordCount: number,
  lead: number,
): number {
  if (wordCount <= 0) return 0;
  const cursor = position + lead;
  if (cursor < start) return 0;
  const span = Math.max(0.16, (nextTime - start) * 0.9);
  return Math.min(wordCount, Math.max(0, Math.floor(((cursor - start) / span) * wordCount) + 1));
}

function visualDistance(distance: number): number {
  return distance > 2 ? 3 : distance;
}

function LyricTicker() {
  const clock = useContext(LyricClockContext);
  const progress = useProgress(LYRIC_TICK_S);

  useLayoutEffect(() => {
    clock?.set(progress.position);
  }, [clock, progress.position]);

  return null;
}

function useClock(): LyricClock {
  const clock = useContext(LyricClockContext);
  if (!clock) {
    throw new Error('Lyric clock missing');
  }
  return clock;
}

function useClockValue(getSnapshot: (position: number) => number): number {
  const clock = useClock();
  const getSnapshotRef = useRef(getSnapshot);
  getSnapshotRef.current = getSnapshot;

  return useSyncExternalStore(
    clock.subscribe,
    () => getSnapshotRef.current(clock.get()),
    () => getSnapshotRef.current(clock.get()),
  );
}

const StaticLineText = memo(function StaticLineText({
  text,
  active,
  distance,
}: {
  text: string;
  active: boolean;
  distance: number;
}) {
  return (
    <Text numberOfLines={2} style={lineTextStyle(active, distance)}>
      {text}
    </Text>
  );
});

const KaraokeWords = memo(function KaraokeWords({
  words,
  litCount,
  distance,
}: {
  words: string[];
  litCount: number;
  distance: number;
}) {
  return (
    <Text numberOfLines={2} style={lineTextStyle(true, distance)}>
      {words.map((word, index) => (
        <Text
          key={`${word}-${index}`}
          style={{ color: index < litCount ? colors.text : 'rgba(226,232,240,0.42)' }}
        >
          {word}
          {index < words.length - 1 ? ' ' : ''}
        </Text>
      ))}
    </Text>
  );
});

function ActiveLineText({
  words,
  start,
  nextTime,
  lead,
  distance,
}: {
  words: string[];
  start: number;
  nextTime: number;
  lead: number;
  distance: number;
}) {
  const litCount = useClockValue((position) =>
    litWordCount(position, start, nextTime, words.length, lead),
  );
  if (words.length <= 1) {
    return <StaticLineText text={words[0] ?? ''} active distance={distance} />;
  }
  return <KaraokeWords words={words} litCount={litCount} distance={distance} />;
}

const LyricRow = memo(function LyricRow({
  text,
  words,
  start,
  nextTime,
  lead,
  active,
  sung,
  distance,
  onSeek,
}: {
  text: string;
  words: string[];
  start: number;
  nextTime: number;
  lead: number;
  active: boolean;
  sung: boolean;
  distance: number;
  onSeek?: (position: number) => void;
}) {
  return (
    <Pressable onPress={() => onSeek?.(start)} style={rowStyle}>
      {active && !sung ? (
        <ActiveLineText
          words={words}
          start={start}
          nextTime={nextTime}
          lead={lead}
          distance={distance}
        />
      ) : (
        <StaticLineText text={text} active={active} distance={distance} />
      )}
    </Pressable>
  );
});

const LyricsList = memo(function LyricsList({
  lines,
  height,
  onSeek,
}: {
  lines: LyricLine[];
  height: number;
  onSeek?: (position: number) => void;
}) {
  const listRef = useRef<FlatList<PreparedLine>>(null);
  const userPausedUntil = useRef(0);
  const lastIndex = useRef(-1);
  const lead = useMemo(() => lyricLeadSeconds(lines), [lines]);
  const prepared = useMemo<PreparedLine[]>(
    () =>
      lines.map((line, index) => ({
        ...line,
        words: lineWords(line.text),
        nextTime: lines[index + 1]?.time ?? line.time + 1.6,
      })),
    [lines],
  );
  const activeIndex = useClockValue((position) => activeLyricIndex(lines, position, lead));
  const visibleRows = Math.max(6, Math.ceil(height / LINE_HEIGHT) + 4);
  const pad = Math.max(28, height / 2 - LINE_HEIGHT / 2);

  useEffect(() => {
    lastIndex.current = -1;
  }, [lines]);

  useEffect(() => {
    if (prepared.length === 0) return;
    if (Date.now() < userPausedUntil.current) return;
    if (activeIndex === lastIndex.current) return;
    const jump = lastIndex.current < 0 ? 99 : Math.abs(activeIndex - lastIndex.current);
    lastIndex.current = activeIndex;
    listRef.current?.scrollToOffset({
      offset: activeIndex * LINE_HEIGHT,
      animated: jump === 1,
    });
  }, [activeIndex, prepared.length]);

  const pauseAutoScroll = useCallback(() => {
    userPausedUntil.current = Date.now() + RESUME_AUTO_SCROLL_MS;
  }, []);

  const getLayout = useCallback(
    (_: unknown, index: number) => ({
      length: LINE_HEIGHT,
      offset: pad + LINE_HEIGHT * index,
      index,
    }),
    [pad],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: PreparedLine; index: number }) => (
      <LyricRow
        text={item.text}
        words={item.words}
        start={item.time}
        nextTime={item.nextTime}
        lead={lead}
        active={index === activeIndex}
        sung={index < activeIndex}
        distance={visualDistance(Math.abs(index - activeIndex))}
        onSeek={onSeek}
      />
    ),
    [activeIndex, lead, onSeek],
  );

  return (
    <FlatList
      ref={listRef}
      data={prepared}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      extraData={activeIndex}
      showsVerticalScrollIndicator={false}
      getItemLayout={getLayout}
      contentContainerStyle={{
        paddingVertical: pad,
        paddingHorizontal: 22,
      }}
      initialNumToRender={visibleRows}
      maxToRenderPerBatch={8}
      windowSize={5}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews
      onScrollBeginDrag={pauseAutoScroll}
      onMomentumScrollEnd={pauseAutoScroll}
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({
          offset: info.index * LINE_HEIGHT,
          animated: false,
        });
      }}
    />
  );
});

const LyricsFrame = memo(function LyricsFrame({
  height,
  title,
  artist,
  children,
}: {
  height: number;
  title: string;
  artist: string;
  children: ReactNode;
}) {
  const palette = brightCoverPalette(title, artist);
  const radius = 28;

  return (
    <View
      style={{
        width: '100%',
        height,
        alignSelf: 'center',
        shadowColor: palette[1],
        shadowOpacity: 0.55,
        shadowRadius: 36,
        shadowOffset: { width: 0, height: 14 },
        elevation: 18,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          top: 10,
          bottom: 10,
          borderRadius: radius + 8,
          backgroundColor: palette[0],
          opacity: 0.28,
        }}
      />

      <View
        style={{
          flex: 1,
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.16)',
        }}
      >
        <LinearGradient
          colors={['#15244A', '#0E1A36', '#0B1224']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={fill}
        />
        <LinearGradient
          colors={[`${palette[0]}55`, `${palette[1]}22`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={fill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'transparent']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.7, y: 0.45 }}
          style={shine}
        />

        {children}

        <LinearGradient
          pointerEvents="none"
          colors={['rgba(15,26,54,0.96)', 'rgba(15,26,54,0.45)', 'transparent']}
          style={topFade}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', 'rgba(11,18,36,0.5)', 'rgba(11,18,36,0.96)']}
          style={bottomFade}
        />
      </View>
    </View>
  );
});

type Props = {
  lines: LyricLine[];
  height: number;
  title?: string;
  artist?: string;
  onSeek?: (position: number) => void;
};

export function PlayerLyrics({
  lines,
  height,
  title = '',
  artist = '',
  onSeek,
}: Props) {
  const clockRef = useRef<LyricClock | null>(null);
  if (!clockRef.current) clockRef.current = createLyricClock();

  return (
    <LyricClockContext.Provider value={clockRef.current}>
      <LyricTicker />
      <LyricsFrame height={height} title={title} artist={artist}>
        <LyricsList lines={lines} height={height} onSeek={onSeek} />
      </LyricsFrame>
    </LyricClockContext.Provider>
  );
}

function lineTextStyle(active: boolean, distance: number) {
  return {
    width: '100%' as const,
    textAlign: 'center' as const,
    color: active ? colors.text : 'rgba(226,232,240,0.86)',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: active ? ('700' as const) : ('500' as const),
    letterSpacing: active ? -0.2 : 0.1,
    opacity: active ? 1 : distance === 1 ? 0.86 : distance === 2 ? 0.62 : 0.42,
    transform: [{ scale: active ? 1.08 : 1 }],
  };
}

const rowStyle = {
  height: LINE_HEIGHT,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
};

const fill = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };
const shine = { position: 'absolute' as const, top: 0, right: 0, height: '55%' as const, left: 0 };
const topFade = { position: 'absolute' as const, top: 0, left: 0, right: 0, height: 52 };
const bottomFade = { position: 'absolute' as const, bottom: 0, left: 0, right: 0, height: 52 };

function keyExtractor(item: PreparedLine, index: number) {
  return `${item.time}-${index}`;
}
