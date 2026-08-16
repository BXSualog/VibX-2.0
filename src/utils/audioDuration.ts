import * as FileSystem from 'expo-file-system/legacy';

const MPEG1_BITRATE = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG2_BITRATE = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const MPEG1_RATE = [44100, 48000, 32000];
const MPEG2_RATE = [22050, 24000, 16000];
const HEAD_BYTES = 131072;

export function normalizeDuration(value?: number | null, fileSize?: number): number {
  if (!value || !Number.isFinite(value) || value <= 0) return 0;

  const asSeconds = value;
  const asMillis = value / 1000;

  if (fileSize && fileSize > 1024) {
    const secondsFit = bitrateFits(fileSize, asSeconds);
    const millisFit = bitrateFits(fileSize, asMillis);
    if (millisFit && !secondsFit) return asMillis;
    if (secondsFit && !millisFit) return asSeconds;
  }

  // Expo MediaLibrary legacy duration is seconds. Raw MediaStore values are ms.
  if (value >= 100_000) return asMillis;
  return asSeconds;
}

function bitrateFits(fileSize: number, seconds: number): boolean {
  if (seconds <= 0) return false;
  const kbps = (fileSize * 8) / seconds / 1000;
  return kbps >= 8 && kbps <= 1411;
}

export async function readFileDuration(uri: string, fileSize?: number): Promise<number> {
  try {
    const size = fileSize && fileSize > 0 ? fileSize : await readFileSize(uri);
    const head = await readMpegHead(uri);
    if (!head || head.length < 16) return 0;
    return parseMp3Duration(head, size);
  } catch {
    return 0;
  }
}

async function readMpegHead(uri: string): Promise<Uint8Array | null> {
  const probe = await readFileRange(uri, 0, 16);
  if (!probe || probe.length < 10) return readFileRange(uri, 0, HEAD_BYTES);

  if (probe[0] === 0x49 && probe[1] === 0x44 && probe[2] === 0x33) {
    const tagSize =
      ((probe[6] & 0x7f) << 21) |
      ((probe[7] & 0x7f) << 14) |
      ((probe[8] & 0x7f) << 7) |
      (probe[9] & 0x7f);
    const frameStart = 10 + tagSize + (probe[5] & 0x10 ? 10 : 0);
    if (frameStart > 16) {
      return readFileRange(uri, frameStart, HEAD_BYTES);
    }
  }

  return readFileRange(uri, 0, HEAD_BYTES);
}

async function readFileRange(uri: string, position: number, length: number): Promise<Uint8Array | null> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  if (!base64) return null;
  return base64ToBytes(base64);
}

async function readFileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && 'size' in info && typeof info.size === 'number' ? info.size : 0;
  } catch {
    return 0;
  }
}

function base64ToBytes(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function parseMp3Duration(bytes: Uint8Array, fileSize: number): number {
  let offset = 0;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const size =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    offset = 10 + size + (bytes[5] & 0x10 ? 10 : 0);
  }

  while (offset + 4 < bytes.length && !(bytes[offset] === 0xff && (bytes[offset + 1] & 0xe0) === 0xe0)) {
    offset += 1;
  }
  if (offset + 4 >= bytes.length) return 0;

  const header = readMpegHeader(bytes, offset);
  if (!header) return 0;

  const xing = offset + 4 + header.sideInfo;
  const frames = readXingFrames(bytes, xing);
  if (frames > 0) {
    return frames * header.samplesPerFrame / header.sampleRate;
  }

  if (header.bitrate > 0 && fileSize > offset) {
    return ((fileSize - offset) * 8) / (header.bitrate * 1000);
  }
  return 0;
}

function readMpegHeader(bytes: Uint8Array, offset: number) {
  const b1 = bytes[offset + 1];
  const b2 = bytes[offset + 2];
  const versionBits = (b1 >> 3) & 3;
  const layerBits = (b1 >> 1) & 3;
  if (versionBits === 1 || layerBits === 0) return null;

  const version = versionBits === 3 ? 1 : 2;
  const bitrateIndex = (b2 >> 4) & 0xf;
  const rateIndex = (b2 >> 2) & 3;
  if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;

  const channelMode = (bytes[offset + 3] >> 6) & 3;
  const bitrate = (version === 1 ? MPEG1_BITRATE : MPEG2_BITRATE)[bitrateIndex];
  const sampleRate = (version === 1 ? MPEG1_RATE : MPEG2_RATE)[rateIndex];
  const samplesPerFrame = version === 1 ? 1152 : 576;
  const sideInfo = version === 1 ? (channelMode === 3 ? 17 : 32) : channelMode === 3 ? 9 : 17;

  return { bitrate, sampleRate, samplesPerFrame, sideInfo };
}

function readXingFrames(bytes: Uint8Array, offset: number): number {
  if (offset + 12 >= bytes.length) return 0;
  const tag = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  if (tag !== 'Xing' && tag !== 'Info') return 0;
  const flags = bytes[offset + 7];
  if ((flags & 1) === 0) return 0;
  return (
    (bytes[offset + 8] << 24) |
    (bytes[offset + 9] << 16) |
    (bytes[offset + 10] << 8) |
    bytes[offset + 11]
  );
}
