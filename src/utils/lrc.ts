export type LyricLine = {
  time: number;
  text: string;
};

const TIME_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const STAMP_TAG =
  /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]|<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g;
const OFFSET_TAG = /\[offset:([+-]?\d+)\]/i;
const META_LINE = /^\[(ti|ar|al|au|by|offset|length|re|ve|tool):/i;
const CJK = /[\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF66-\uFF9D]/;
const PHRASE_BREAK = /(\s*[,:;!?…]+\s*|\s+\/\s+|\s+\|\s+|\s+-{1,2}\s+)/;

type Stamp = {
  time: number;
  start: number;
  end: number;
};

function timestampToSeconds(min: string, sec: string, frac?: string): number {
  const minutes = Number(min);
  const seconds = Number(sec);
  const raw = frac ?? '';
  const millis =
    raw.length <= 0 ? 0 : raw.length === 1 ? Number(raw) * 100 : raw.length === 2 ? Number(raw) * 10 : Number(raw);
  return minutes * 60 + seconds + millis / 1000;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function wordCount(text: string): number {
  const cleaned = cleanText(text);
  if (!cleaned) return 0;
  if (!/\s/.test(cleaned) && CJK.test(cleaned)) return Math.max(1, Math.ceil([...cleaned].length / 2));
  return cleaned.split(/\s+/).length;
}

function charWeight(text: string): number {
  const compact = text.replace(/\s+/g, '');
  return Math.max(compact.length, 1);
}

function collectStamps(row: string): Stamp[] {
  const stamps: Stamp[] = [];
  STAMP_TAG.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STAMP_TAG.exec(row))) {
    const time =
      match[1] != null
        ? timestampToSeconds(match[1], match[2], match[3])
        : timestampToSeconds(match[4], match[5], match[6]);
    stamps.push({ time, start: match.index, end: match.index + match[0].length });
  }
  return stamps;
}

function parseLyricRow(row: string, offset: number): LyricLine[] {
  const stamps = collectStamps(row);
  if (stamps.length === 0) return [];

  const segments = stamps.map((stamp, index) => {
    const from = stamp.end;
    const to = index + 1 < stamps.length ? stamps[index + 1].start : row.length;
    return {
      time: Math.max(0, stamp.time + offset),
      text: cleanText(row.slice(from, to)),
    };
  });

  const leading: number[] = [];
  let cursor = 0;
  while (cursor < segments.length && !segments[cursor].text) {
    leading.push(segments[cursor].time);
    cursor += 1;
  }
  const rest = segments.slice(cursor).filter((segment) => segment.text);
  if (rest.length === 0) return [];

  if (rest.length === 1) {
    return [...leading, rest[0].time].map((time) => ({ time, text: rest[0].text }));
  }

  return rest;
}

function splitPhrasePieces(text: string): string[] {
  const cleaned = cleanText(text);
  if (!cleaned) return [];
  if (!/\s/.test(cleaned) && CJK.test(cleaned)) {
    return cleaned
      .split(/([，。！？、；：])/u)
      .map((part) => part.trim())
      .filter((part) => part && !/^[，。！？、；：]+$/u.test(part));
  }

  const parts = cleaned.split(PHRASE_BREAK);
  const pieces: string[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part || PHRASE_BREAK.test(part)) continue;
    const next = cleanText(part);
    if (next) pieces.push(next);
  }
  return pieces.length > 0 ? pieces : [cleaned];
}

function tokensFromPiece(piece: string): { word: string; breakAfter: boolean }[] {
  if (!/\s/.test(piece) && CJK.test(piece)) {
    const chars = [...piece];
    const size = 8;
    const tokens: { word: string; breakAfter: boolean }[] = [];
    for (let index = 0; index < chars.length; index += size) {
      tokens.push({
        word: chars.slice(index, index + size).join(''),
        breakAfter: index + size >= chars.length,
      });
    }
    return tokens;
  }
  const words = piece.split(/\s+/).filter(Boolean);
  return words.map((word, index) => ({
    word,
    breakAfter: index === words.length - 1,
  }));
}

function packByWords(pieces: string[], maxWords: number): string[] {
  const tokens = pieces.flatMap((piece, index) => {
    const next = tokensFromPiece(piece);
    if (next.length === 0) return next;
    if (index === pieces.length - 1) {
      next[next.length - 1] = { ...next[next.length - 1], breakAfter: false };
    }
    return next;
  });

  const phrases: string[] = [];
  let bucket: string[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    phrases.push(bucket.join(' '));
    bucket = [];
  };

  for (const token of tokens) {
    bucket.push(token.word);
    if (bucket.length >= maxWords || (token.breakAfter && bucket.length >= 2)) flush();
  }
  flush();
  if (phrases.length >= 2 && phrases[phrases.length - 1].split(/\s+/).length === 1) {
    const tail = phrases.pop()!;
    phrases[phrases.length - 1] = `${phrases[phrases.length - 1]} ${tail}`;
  }
  return phrases;
}

function expandDenseLine(line: LyricLine, nextTime: number): LyricLine[] {
  const gap = Math.max(nextTime - line.time, 0);
  const words = wordCount(line.text);
  if (words <= 4 || gap < 0.55) return [line];

  const wps = words / Math.max(gap, 0.28);
  const dense = wps >= 2.2 || words >= 8;
  if (!dense) return [line];

  const maxWords = wps >= 3.4 ? 4 : wps >= 2.7 ? 5 : 6;
  const phrases = packByWords(splitPhrasePieces(line.text), maxWords);
  if (phrases.length <= 1) return [line];

  const perWord = wps >= 3.4 ? 0.22 : wps >= 2.7 ? 0.26 : 0.32;
  const window = Math.min(gap * 0.92, words * perWord, Math.max(gap - 0.04, 0.2));
  const weights = phrases.map(charWeight);
  const total = weights.reduce((sum, value) => sum + value, 0);
  let elapsed = 0;
  return phrases.map((text, index) => {
    const time = line.time + (elapsed / total) * window;
    elapsed += weights[index];
    return { time, text };
  });
}

function packWordTimedLines(lines: LyricLine[]): LyricLine[] {
  const shortRuns = lines.filter((line) => wordCount(line.text) <= 3).length;
  if (lines.length < 8 || shortRuns / lines.length < 0.55) return lines;

  const packed: LyricLine[] = [];
  let bucket: LyricLine[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    packed.push({
      time: bucket[0].time,
      text: bucket.map((line) => line.text).join(' '),
    });
    bucket = [];
  };

  for (const line of lines) {
    const words = wordCount(line.text);
    if (words >= 6) {
      flush();
      packed.push(line);
      continue;
    }
    const span = bucket.length > 0 ? line.time - bucket[0].time : 0;
    const bucketWords = bucket.reduce((sum, item) => sum + wordCount(item.text), 0) + words;
    if (bucket.length > 0 && (bucketWords > 5 || span > 1.15)) flush();
    bucket.push(line);
  }
  flush();
  return packed;
}

export function prepareLyricLines(lines: LyricLine[]): LyricLine[] {
  const sorted = [...lines]
    .filter((line) => line.text)
    .sort((left, right) => left.time - right.time);
  if (sorted.length === 0) return [];

  const unique: LyricLine[] = [];
  for (const line of sorted) {
    const prev = unique[unique.length - 1];
    if (prev && prev.text === line.text && Math.abs(prev.time - line.time) < 0.04) continue;
    unique.push(line);
  }

  const packed = packWordTimedLines(unique);
  const prepared: LyricLine[] = [];
  for (let index = 0; index < packed.length; index += 1) {
    const nextTime =
      packed[index + 1]?.time ?? packed[index].time + Math.max(1.2, wordCount(packed[index].text) * 0.28);
    prepared.push(...expandDenseLine(packed[index], nextTime));
  }
  return prepared;
}

export function looksLikeLrc(content: string): boolean {
  TIME_TAG.lastIndex = 0;
  return TIME_TAG.test(content);
}

export function parseLrc(content: string): LyricLine[] {
  const offsetMatch = content.match(OFFSET_TAG);
  const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;
  const lines: LyricLine[] = [];

  for (const raw of content.split(/\r?\n/)) {
    const row = raw.trim();
    if (!row || META_LINE.test(row)) continue;
    lines.push(...parseLyricRow(row, offset));
  }

  return prepareLyricLines(lines);
}

export function parseUnsyncedLyrics(content: string, duration = 0): LyricLine[] {
  const trimmed = content.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return [];
  if (looksLikeLrc(trimmed)) return parseLrc(trimmed);

  const parts = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !META_LINE.test(line));
  if (parts.length === 0) return [];

  const span = duration > 0 ? duration : Math.max(parts.length * 3, 1);
  return parts.map((text, index) => ({
    time: (span * index) / parts.length,
    text,
  }));
}

export function lyricLeadSeconds(lines: LyricLine[]): number {
  if (lines.length < 3) return 0.14;
  const gaps: number[] = [];
  let words = 0;
  let spoken = 0;
  for (let index = 0; index < lines.length - 1; index += 1) {
    const gap = lines[index + 1].time - lines[index].time;
    if (gap > 0.08 && gap < 8) {
      gaps.push(gap);
      spoken += gap;
    }
    words += wordCount(lines[index].text);
  }
  if (gaps.length === 0) return 0.14;

  gaps.sort((left, right) => left - right);
  const median = gaps[Math.floor(gaps.length / 2)];
  const wps = spoken > 0 ? words / spoken : 0;

  let lead = 0.16;
  if (wps >= 3.3 || median <= 0.95) lead = 0.28;
  else if (wps >= 2.4 || median <= 1.45) lead = 0.22;

  return Math.min(lead, Math.max(0.1, median * 0.34));
}

export function activeLyricIndex(lines: LyricLine[], position: number, lead = 0.05): number {
  if (lines.length === 0) return 0;
  const cursor = position + lead;
  let lo = 0;
  let hi = lines.length - 1;
  let index = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= cursor) {
      index = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return index;
}
