import { originalArtistsForCoverTitle, normalizeCoverTitle } from '@/src/services/lyrics/coverOriginals';
import type { Song } from '@/src/types/music';
import { artistMatchKey, FILIPINO_ARTISTS } from '@/src/utils/knownArtists';
import { decodeDisplayName, normalizeTrackLabels, parseFilenameMetadata } from '@/src/utils/metadata';

export type LyricsQuery = {
  title: string;
  artist: string;
  album?: string;
  original?: boolean;
};

const CJK =
  /[\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF66-\uFF9D]+/g;
const LATIN = /[\p{Script=Latin}0-9][\p{Script=Latin}0-9 .''-]*/gu;
const LOOKUP_JUNK =
  /\b(official\s*(music\s*)?(video|audio)|lyric\s*videos?|lyrics?|audio(?:\s*only)?|hd|hq|4k|mv|music video|visualizer|explicit|clean|remaster(?:ed)?|live|slowed(?:\s*reverb)?|performance\s*video|opm(?:\s*hits)?|tagalog|filipino|pinoy(?:\s*hits)?|karaoke|topic|vevo)\b/gi;
const BRACKET_JUNK = /[([{][^)\]}]*[)\]}]/g;
const FEATURE_SPLIT =
  /\s*(?:,|;|\+|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bkasama(?:\s+(?:si|sina))?|\sx\s|\s×\s)\s*/i;
const COVER_NAME = /\bskate\s*avenn?ue(?:\s*ph)?\b/gi;
const COVER_VERSION =
  /\s*[-–—:,(\[]\s*(?:(?:punk|ai|opm)\s+)?(?:rock\s+)?(?:cover|version|ver\.?)\s*[)\]]?\s*$/i;
const COVER_KEYS = ['skateavenue', 'skateavennue'];
const FILIPINO_ARTIST_KEYS = new Set(FILIPINO_ARTISTS.map((name) => artistMatchKey(name)));

function stripCoverNoise(value: string): string {
  return tidy(
    normalizeCoverTitle(
      tidy(value)
        .replace(COVER_NAME, ' ')
        .replace(COVER_VERSION, ' ')
        .replace(/\b(non[\s-]*stop|best playlist|ai rock|ost|opening|ending|theme song|original songs?)\b/gi, ' '),
    ),
  );
}

export function isCoverProject(value?: string): boolean {
  const key = artistMatchKey(value ?? '');
  return Boolean(key) && COVER_KEYS.some((name) => key === name || key.startsWith(name));
}

function useful(value?: string): boolean {
  const text = value?.trim() ?? '';
  if (!text || /^unknown( artist| title)?$/i.test(text)) return false;
  return [...text].length >= 1;
}

function usefulAlbum(value?: string): boolean {
  return useful(value) && !/^(imported|on this device|downloads?|unknown album)$/i.test(value!.trim());
}

function tidy(value: string): string {
  return decodeDisplayName(value)
    .replace(/_+/g, ' ')
    .replace(/\s*[-–—]+\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—.\s]+|[-–—.\s]+$/g, '')
    .trim();
}

function stripLookupJunk(value: string): string {
  return tidy(
    tidy(value)
      .replace(/\s*-\s*topic\s*$/i, '')
      .replace(COVER_NAME, ' ')
      .replace(COVER_VERSION, ' ')
      .replace(BRACKET_JUNK, ' ')
      .replace(LOOKUP_JUNK, ' ')
      .replace(/\s{2,}/g, ' '),
  );
}

function filenameBase(path: string): string {
  const clean = path.split('?')[0] ?? '';
  return decodeDisplayName(clean.split(/[/\\]/).pop() ?? '');
}

function apostropheVariants(value: string): string[] {
  const variants = [value];
  const squeezed = value.replace(/['’]/g, '');
  if (squeezed !== value) variants.push(squeezed);
  return variants;
}

function ampersandVariants(value: string): string[] {
  const variants = [value];
  if (!value.includes('&')) return variants;
  variants.push(value.replace(/\s*&\s*/g, ' & '));
  variants.push(value.replace(/\s*&\s*/g, ' and '));
  variants.push(value.replace(/\s*&\s*/g, ''));
  return variants;
}

function titleVariants(title: string): string[] {
  CJK.lastIndex = 0;
  LATIN.lastIndex = 0;
  const cleaned = stripLookupJunk(title) || tidy(title);
  const variants = [cleaned];
  const stripped = cleaned.replace(/\s*[([{].*?[)\]}]/g, '').trim();
  if (stripped) variants.push(stripped);

  for (const chunk of cleaned.match(CJK) ?? []) {
    if (useful(chunk)) variants.push(chunk);
  }
  for (const chunk of cleaned.match(LATIN) ?? []) {
    const next = chunk.trim();
    if (next.length >= 2 && next !== cleaned) variants.push(next);
  }
  return variants.flatMap(apostropheVariants);
}

function artistVariants(artist: string): string[] {
  const cleaned = stripLookupJunk(artist);
  if (!useful(cleaned)) return [''];
  const parts = cleaned
    .split(FEATURE_SPLIT)
    .map((part) => part.trim())
    .filter(useful);
  const names = [cleaned, ...parts].flatMap(ampersandVariants);
  return names.filter((name, index) => names.findIndex((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase()) === index);
}

function pushVariant(list: LyricsQuery[], next: LyricsQuery) {
  const title = stripCoverNoise(stripLookupJunk(next.title) || tidy(next.title));
  const artist = isCoverProject(next.artist) ? '' : stripLookupJunk(next.artist);
  if (!useful(title) || isCoverProject(title)) return;
  const album = usefulAlbum(next.album) ? tidy(next.album!) : undefined;
  const key = `${title}|${artist}|${album ?? ''}|${next.original ? 'o' : ''}`.toLocaleLowerCase();
  if (list.some((item) => `${item.title}|${item.artist}|${item.album ?? ''}|${item.original ? 'o' : ''}`.toLocaleLowerCase() === key)) {
    return;
  }
  list.push({ title, artist: useful(artist) ? artist : '', album, original: next.original });
}

function knownFilipinoArtist(value: string): boolean {
  const key = artistMatchKey(value);
  return Boolean(key) && FILIPINO_ARTIST_KEYS.has(key);
}

export function lyricsQueriesForSong(song: Song): LyricsQuery[] {
  const queries: LyricsQuery[] = [];
  const labels = normalizeTrackLabels(song.title, song.artist);
  const sources = [
    { title: song.title, artist: song.artist, album: song.album },
    { title: labels.title, artist: labels.artist, album: song.album },
    { title: stripLookupJunk(song.title), artist: stripLookupJunk(song.artist), album: song.album },
    { title: stripLookupJunk(labels.title), artist: stripLookupJunk(labels.artist), album: song.album },
  ];

  const file = filenameBase(song.localPath);
  if (file) {
    const parsed = parseFilenameMetadata(file.replace(/_+/g, ' '));
    sources.push({
      title: parsed.title,
      artist: parsed.artist,
      album: parsed.album ?? song.album,
    });
    const combined = tidy(file);
    if (combined.includes(' - ')) {
      const parsedCombined = parseFilenameMetadata(combined);
      sources.push({
        title: parsedCombined.title,
        artist: parsedCombined.artist,
        album: song.album,
      });
    }
  }

  const swapped = sources
    .filter((source) => knownFilipinoArtist(source.title) && useful(source.artist) && !knownFilipinoArtist(source.artist))
    .map((source) => ({ title: source.artist, artist: source.title, album: source.album }));
  sources.push(...swapped);

  for (const source of sources) {
    const cover = isCoverProject(source.artist) || isCoverProject(source.title);
    const titles = titleVariants(source.title).map(stripCoverNoise).filter((title) => useful(title) && !isCoverProject(title));
    for (const title of titles) {
      const artists = cover
        ? originalArtistsForCoverTitle(title)
        : artistVariants(source.artist).filter((name) => !isCoverProject(name));
      for (const artist of artists) {
        pushVariant(queries, { title, artist, album: cover ? undefined : source.album, original: cover });
      }
      if (cover || artists.length === 0 || title.split(/\s+/).length >= 2) {
        pushVariant(queries, { title, artist: '', album: undefined, original: cover });
      }
    }
  }

  queries.sort((left, right) => {
    const originalDelta = Number(Boolean(right.original)) - Number(Boolean(left.original));
    if (originalDelta) return originalDelta;
    return Number(Boolean(right.artist)) - Number(Boolean(left.artist));
  });
  return queries.slice(0, 18);
}
