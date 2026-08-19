import { artistKey, artistMatchKey, artistGroupKey, canonicalArtistName, KNOWN_ARTISTS } from '@/src/utils/knownArtists';
import { readId3Tags } from '@/src/utils/id3';

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|wma|aiff)$/i;
const JUNK =
  /\s*[([{]?\s*(official\s*(music\s*)?(video|audio)|lyrics?|lyric video|audio|hd|hq|mv|music video|visualizer|explicit|clean|remaster(ed)?|live|slowed|reverb)\s*[)\]}]?\s*/gi;
const BRACKET_TAG = /\[[^\]]*(vietsub|karaoke|lyrics?|official|audio|mv|visualizer|audio only)[^\]]*\]/gi;
const TRACK_NO = /^\s*\d{1,3}(\s*[-.)]\s*|\s+)/;
const BITRATE = /\s*\d{2,3}\s*k?bps\s*/gi;
const ENCODED = /%[0-9A-Fa-f]{2}/;

export type TrackMetadata = {
  title: string;
  artist: string;
  album?: string;
};

export function decodeDisplayName(value?: string | null): string {
  if (value == null || value === '') return '';
  let text = String(value).trim();
  for (let i = 0; i < 4; i += 1) {
    if (!ENCODED.test(text)) break;
    try {
      const next = decodeURIComponent(text);
      if (next === text) break;
      text = next;
    } catch {
      break;
    }
  }
  return text.replace(/\s+/g, ' ').trim();
}

function spacedFilename(value: string): string {
  return value
    .replace(/_+/g, ' ')
    .replace(/\s*[-–—]+\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—.\s]+|[-–—.\s]+$/g, '')
    .trim();
}

const LABEL_CACHE_LIMIT = 12000;
const labelCache = new Map<string, TrackMetadata>();
let defaultKnownArtists: Set<string> | null = null;

export function normalizeTrackLabels(title?: string | null, artist?: string | null): TrackMetadata {
  const key = `${title ?? ''}\u0000${artist ?? ''}`;
  const cached = labelCache.get(key);
  if (cached) return cached;

  const result = computeTrackLabels(title, artist);
  if (labelCache.size >= LABEL_CACHE_LIMIT) labelCache.clear();
  labelCache.set(key, result);
  return result;
}

function computeTrackLabels(title?: string | null, artist?: string | null): TrackMetadata {
  try {
    const decodedTitle = decodeDisplayName(title);
    const decodedArtist = decodeDisplayName(artist);
    const spacedTitle = spacedFilename(decodedTitle) || decodedTitle;
    const unknownArtist = !usefulTag(decodedArtist);
    const combined = / [-–—] /.test(spacedTitle);
    const encoded = ENCODED.test(String(title ?? '')) || ENCODED.test(String(artist ?? ''));
    const known = knownArtistSet();

    if (encoded || (unknownArtist && combined)) {
      const parsed = parseFilenameMetadata(spacedTitle || decodedTitle);
      return finishLabels(
        parsed.title,
        usefulTag(decodedArtist) && !isKnownArtist(spacedTitle, known)
          ? decodedArtist
          : parsed.artist,
        parsed.album,
      );
    }

    if (isKnownArtist(spacedTitle, known) && !isKnownArtist(decodedArtist, known) && usefulTag(decodedArtist)) {
      return finishLabels(decodedArtist, spacedTitle);
    }

    return finishLabels(spacedTitle, decodedArtist);
  } catch {
    return { title: decodeDisplayName(title) || 'Unknown Title', artist: decodeDisplayName(artist) || 'Unknown Artist' };
  }
}

function finishLabels(title: string, artist: string, album?: string): TrackMetadata {
  const cleanedArtist = usefulTag(artist) ? canonicalArtistName(artist) : '';
  return {
    title: title || 'Unknown Title',
    artist: cleanedArtist || 'Unknown Artist',
    album,
  };
}

function cleanPart(value: string): string {
  return decodeDisplayName(value)
    .replace(BRACKET_TAG, ' ')
    .replace(JUNK, ' ')
    .replace(BITRATE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function knownArtistSet(extra: string[] = []): Set<string> {
  if (extra.length === 0) {
    if (!defaultKnownArtists) {
      defaultKnownArtists = new Set(KNOWN_ARTISTS.map(artistMatchKey));
    }
    return defaultKnownArtists;
  }
  return new Set([...KNOWN_ARTISTS, ...extra].map(artistMatchKey));
}

function isKnownArtist(value: string, known: Set<string>): boolean {
  const compact = artistMatchKey(value);
  const grouped = artistGroupKey(value);
  return Boolean(compact) && (known.has(compact) || known.has(grouped));
}

function looksLikeBandName(value: string): boolean {
  const raw = value.trim();
  const compact = artistMatchKey(raw);
  if (compact.length < 2 || compact.length > 10) return false;
  const squeezed = raw.replace(/[\s*'._-]+/g, '');
  if (/^[*'"]?[A-Z0-9]{2,10}$/.test(squeezed)) return true;
  return /^(n\s*sync|\*?nsync)$/i.test(raw);
}

function artistScore(value: string, known: Set<string>): number {
  const compact = artistMatchKey(value);
  if (!compact) return -2;
  let score = 0;
  if (known.has(compact) || isKnownArtist(value, known)) score += 10;
  if (/\b(feat|ft|featuring)\b/.test(artistKey(value))) score -= 6;
  if (looksLikeBandName(value)) score += 4;
  return score;
}

export function parseFilenameMetadata(filename: string, knownArtists: string[] = []): TrackMetadata {
  const base = cleanPart(spacedFilename(filename.replace(AUDIO_EXT, '')).replace(TRACK_NO, '').trim());
  const known = knownArtistSet(knownArtists);
  const separators = [' - ', ' – ', ' — '];

  for (const sep of separators) {
    const index = base.indexOf(sep);
    if (index <= 0) continue;
    const left = cleanPart(base.slice(0, index));
    const right = cleanPart(base.slice(index + sep.length));
    if (!left || !right) continue;

    const rightKnown = isKnownArtist(right, known);
    const leftKnown = isKnownArtist(left, known) || looksLikeBandName(left);
    if (rightKnown && !leftKnown) {
      return { title: left || base, artist: right || 'Unknown Artist' };
    }
    if (rightKnown && leftKnown && artistScore(right, known) > artistScore(left, known) + 1) {
      return { title: left || base, artist: right || 'Unknown Artist' };
    }
    return { title: right || base, artist: left || 'Unknown Artist' };
  }

  return { title: base || 'Unknown Title', artist: 'Unknown Artist' };
}

function usefulTag(value?: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && !/^unknown( artist| title)?$/i.test(trimmed);
}

function tagLooksLikeFilename(title: string, filename: string): boolean {
  const left = artistKey(title);
  const right = artistKey(filename.replace(AUDIO_EXT, ''));
  return left === right || title.includes(' - ') || title.includes(' – ');
}

export async function resolveTrackMetadata(
  uri: string,
  filename: string,
  knownArtists: string[] = []
): Promise<TrackMetadata> {
  const fromName = parseFilenameMetadata(filename, knownArtists);
  try {
    const tags = await readId3Tags(uri);
    const tagTitle = tags?.title ? decodeDisplayName(tags.title) : undefined;
    const tagArtist = tags?.artist ? decodeDisplayName(tags.artist) : undefined;
    const tagAlbum = tags?.album ? decodeDisplayName(tags.album) : undefined;
    const title = usefulTag(tagTitle) && tagTitle && !tagLooksLikeFilename(tagTitle, filename)
      ? tagTitle
      : fromName.title;
    const artist = usefulTag(tagArtist) ? tagArtist! : fromName.artist;
    const album = usefulTag(tagAlbum) ? tagAlbum : undefined;

    if (usefulTag(tagTitle) && usefulTag(tagArtist) && !tagLooksLikeFilename(tagTitle!, filename)) {
      return { title: tagTitle!, artist: tagArtist!, album };
    }

    return { title, artist, album };
  } catch {
    return fromName;
  }
}

export function isAudioFilename(name: string): boolean {
  return AUDIO_EXT.test(name);
}

export function isMp3Filename(name: string): boolean {
  return /\.mp3$/i.test(name);
}

export function sanitizeFilename(name: string): string {
  return decodeDisplayName(name).replace(/[<>:"/\\|?*]/g, '_').trim();
}
