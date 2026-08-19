import * as FileSystem from 'expo-file-system/legacy';

export type Id3Tags = {
  title?: string;
  artist?: string;
  album?: string;
};

export type Id3LyricLine = {
  time: number;
  text: string;
};

export type Id3Lyrics = {
  synced?: Id3LyricLine[];
  unsynced?: string;
};

const HEAD_BYTES = 131072;
const MAX_LYRIC_TAG = 524288;

async function readRange(uri: string, position: number, length: number): Promise<Uint8Array | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    });
    if (!base64) return null;
    return base64ToBytes(base64);
  } catch {
    return null;
  }
}

function base64ToBytes(value: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = value.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let offset = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const chunk =
      (chars.indexOf(clean[index]) << 18) |
      (chars.indexOf(clean[index + 1]) << 12) |
      ((chars.indexOf(clean[index + 2]) & 63) << 6) |
      (chars.indexOf(clean[index + 3]) & 63);
    if (offset < bytes.length) bytes[offset++] = (chunk >> 16) & 255;
    if (offset < bytes.length) bytes[offset++] = (chunk >> 8) & 255;
    if (offset < bytes.length) bytes[offset++] = chunk & 255;
  }
  return bytes;
}

function syncsafe(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function encodingWidth(encoding: number): number {
  return encoding === 1 || encoding === 2 ? 2 : 1;
}

function decodePayload(encoding: number, payload: Uint8Array): string {
  if (payload.length === 0) return '';
  if (encoding === 3) {
    try {
      return new TextDecoder('utf-8').decode(payload).replace(/\u0000/g, '').trim();
    } catch {
      // Fall through to Latin-1 if TextDecoder is unavailable.
    }
  }
  if (encoding === 1 || encoding === 2) {
    let little = encoding === 1;
    let start = 0;
    if (payload.length >= 2) {
      if (payload[0] === 0xff && payload[1] === 0xfe) {
        little = true;
        start = 2;
      } else if (payload[0] === 0xfe && payload[1] === 0xff) {
        little = false;
        start = 2;
      }
    }
    let text = '';
    for (let index = start; index + 1 < payload.length; index += 2) {
      const code = little ? payload[index] | (payload[index + 1] << 8) : (payload[index] << 8) | payload[index + 1];
      if (code) text += String.fromCharCode(code);
    }
    return text.trim();
  }
  let text = '';
  for (let index = 0; index < payload.length; index += 1) {
    if (payload[index]) text += String.fromCharCode(payload[index]);
  }
  return text.trim();
}

function decodeText(data: Uint8Array): string {
  if (data.length === 0) return '';
  return decodePayload(data[0], data.subarray(1));
}

function findEncodedNull(data: Uint8Array, offset: number, encoding: number): number {
  const step = encodingWidth(encoding);
  for (let index = offset; index + step - 1 < data.length; index += step) {
    if (step === 2) {
      if (data[index] === 0 && data[index + 1] === 0) return index;
    } else if (data[index] === 0) {
      return index;
    }
  }
  return data.length;
}

function readEncodedString(
  data: Uint8Array,
  offset: number,
  encoding: number
): { text: string; next: number } {
  const end = findEncodedNull(data, offset, encoding);
  return {
    text: decodePayload(encoding, data.subarray(offset, end)),
    next: Math.min(data.length, end + encodingWidth(encoding)),
  };
}

function parseUnsyncedLyricsFrame(data: Uint8Array): string | undefined {
  if (data.length < 5) return undefined;
  const encoding = data[0];
  const skipped = readEncodedString(data, 4, encoding);
  const text = decodePayload(encoding, data.subarray(skipped.next));
  return text || undefined;
}

function parseSyncedLyricsFrame(data: Uint8Array): Id3LyricLine[] | undefined {
  if (data.length < 8) return undefined;
  const encoding = data[0];
  const timeFormat = data[4];
  if (timeFormat !== 2) return undefined;
  let cursor = readEncodedString(data, 6, encoding).next;
  const lines: Id3LyricLine[] = [];

  while (cursor < data.length) {
    const part = readEncodedString(data, cursor, encoding);
    if (part.next + 4 > data.length) break;
    const stamp =
      ((data[part.next] << 24) | (data[part.next + 1] << 16) | (data[part.next + 2] << 8) | data[part.next + 3]) >>>
      0;
    if (part.text) {
      lines.push({ time: stamp / 1000, text: part.text });
    }
    cursor = part.next + 4;
  }

  return lines.length > 0 ? lines : undefined;
}

function readSize(bytes: Uint8Array, offset: number, sync: boolean): number {
  if (sync) return syncsafe(bytes, offset);
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function parseId3v2(bytes: Uint8Array): Id3Tags | null {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null;
  const major = bytes[3];
  const tagSize = syncsafe(bytes, 6);
  const end = Math.min(bytes.length, 10 + tagSize);
  const tags: Id3Tags = {};
  let cursor = 10;

  while (cursor + 6 < end) {
    if (major === 2) {
      const id = String.fromCharCode(bytes[cursor], bytes[cursor + 1], bytes[cursor + 2]);
      const size = (bytes[cursor + 3] << 16) | (bytes[cursor + 4] << 8) | bytes[cursor + 5];
      if (!id.trim() || size <= 0) break;
      const data = bytes.subarray(cursor + 6, Math.min(end, cursor + 6 + size));
      if (id === 'TT2') tags.title = decodeText(data);
      if (id === 'TP1') tags.artist = decodeText(data);
      if (id === 'TAL') tags.album = decodeText(data);
      cursor += 6 + size;
      continue;
    }

    const id = String.fromCharCode(bytes[cursor], bytes[cursor + 1], bytes[cursor + 2], bytes[cursor + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = readSize(bytes, cursor + 4, major >= 4);
    if (size <= 0 || cursor + 10 + size > end + 32) break;
    const data = bytes.subarray(cursor + 10, Math.min(end, cursor + 10 + size));
    if (id === 'TIT2') tags.title = decodeText(data);
    if (id === 'TPE1') tags.artist = decodeText(data);
    if (id === 'TALB') tags.album = decodeText(data);
    cursor += 10 + size;
  }

  return tags.title || tags.artist || tags.album ? tags : null;
}

function parseId3v1(bytes: Uint8Array): Id3Tags | null {
  if (bytes.length < 128) return null;
  const tag = bytes.subarray(bytes.length - 128);
  if (tag[0] !== 0x54 || tag[1] !== 0x41 || tag[2] !== 0x47) return null;
  const text = (start: number, length: number) => {
    let value = '';
    for (let index = start; index < start + length; index += 1) {
      if (tag[index]) value += String.fromCharCode(tag[index]);
    }
    return value.trim();
  };
  const title = text(3, 30);
  const artist = text(33, 30);
  const album = text(63, 30);
  return title || artist || album ? { title, artist, album } : null;
}

function parseId3v2Lyrics(bytes: Uint8Array): Id3Lyrics | null {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null;
  const major = bytes[3];
  const tagSize = syncsafe(bytes, 6);
  const end = Math.min(bytes.length, 10 + tagSize);
  const lyrics: Id3Lyrics = {};
  let cursor = 10;

  while (cursor + 6 < end) {
    if (major === 2) {
      const id = String.fromCharCode(bytes[cursor], bytes[cursor + 1], bytes[cursor + 2]);
      const size = (bytes[cursor + 3] << 16) | (bytes[cursor + 4] << 8) | bytes[cursor + 5];
      if (!id.trim() || size <= 0) break;
      const data = bytes.subarray(cursor + 6, Math.min(end, cursor + 6 + size));
      if (id === 'ULT' && !lyrics.unsynced) lyrics.unsynced = parseUnsyncedLyricsFrame(data);
      if (id === 'SLT' && !lyrics.synced) lyrics.synced = parseSyncedLyricsFrame(data);
      cursor += 6 + size;
      continue;
    }

    const id = String.fromCharCode(bytes[cursor], bytes[cursor + 1], bytes[cursor + 2], bytes[cursor + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = readSize(bytes, cursor + 4, major >= 4);
    if (size <= 0 || cursor + 10 + size > end + 32) break;
    const data = bytes.subarray(cursor + 10, Math.min(end, cursor + 10 + size));
    if (id === 'USLT' && !lyrics.unsynced) lyrics.unsynced = parseUnsyncedLyricsFrame(data);
    if (id === 'SYLT' && !lyrics.synced) lyrics.synced = parseSyncedLyricsFrame(data);
    cursor += 10 + size;
  }

  return lyrics.synced?.length || lyrics.unsynced ? lyrics : null;
}

function useful(value?: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !/^unknown( artist| title)?$/i.test(trimmed);
}

export async function readId3Tags(uri: string): Promise<Id3Tags | null> {
  const head = await readRange(uri, 0, HEAD_BYTES);
  const v2 = head ? parseId3v2(head) : null;
  if (v2 && (useful(v2.title) || useful(v2.artist))) return v2;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    const size = info.exists && 'size' in info && typeof info.size === 'number' ? info.size : 0;
    if (size >= 128) {
      const tail = await readRange(uri, Math.max(0, size - 128), 128);
      const v1 = tail ? parseId3v1(tail) : null;
      if (v1) return v1;
    }
  } catch {
    // Some content URIs do not expose size.
  }

  return v2;
}

export async function readId3Lyrics(uri: string): Promise<Id3Lyrics | null> {
  const header = await readRange(uri, 0, 10);
  if (!header || header.length < 10 || header[0] !== 0x49 || header[1] !== 0x44 || header[2] !== 0x33) {
    return null;
  }
  const total = Math.min(10 + syncsafe(header, 6), MAX_LYRIC_TAG);
  const bytes = await readRange(uri, 0, Math.max(total, 10));
  return bytes ? parseId3v2Lyrics(bytes) : null;
}
