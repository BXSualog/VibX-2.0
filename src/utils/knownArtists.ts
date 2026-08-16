export const KNOWN_ARTISTS = [
  'ariana grande',
  'arianna grande',
  'justin bieber',
  'taylor swift',
  'ed sheeran',
  'drake',
  'the weeknd',
  'weeknd',
  'billie eilish',
  'bruno mars',
  'rihanna',
  'beyonce',
  'beyoncé',
  'lady gaga',
  'adele',
  'eminem',
  'kanye west',
  'kendrick lamar',
  'post malone',
  'dua lipa',
  'olivia rodrigo',
  'harry styles',
  'shawn mendes',
  'selena gomez',
  'miley cyrus',
  'katy perry',
  'sza',
  'doja cat',
  'nicki minaj',
  'cardi b',
  'bad bunny',
  'the beatles',
  'coldplay',
  'maroon 5',
  'imagine dragons',
  'one direction',
  'bts',
  'blackpink',
  'newjeans',
  'twice',
  'stray kids',
  'seventeen',
  'exo',
  'nct',
  'aespa',
  'ive',
  'itzy',
  'gidle',
  'skate avenue',
  'skate avenue ph',
  'sb19',
  'ben&ben',
  'ben and ben',
  'moira dela torre',
  'sarah geronimo',
  'up dharma down',
  'eraserheads',
  'parokya ni edgar',
  'iv of spades',
  'zack tabudlo',
  'flow g',
  'heather',
  'the 1975',
  'arctic monkeys',
  'radiohead',
  'nirvana',
  'queen',
  'linkin park',
  'metallica',
  'red hot chili peppers',
  'foo fighters',
  'green day',
  'paramore',
  'twenty one pilots',
  'the killers',
  'charlie puth',
  'sam smith',
  'john legend',
  'alessia cara',
  'halsey',
  'lana del rey',
  'lorde',
  'sia',
  'pink',
  'p!nk',
  'usher',
  'chris brown',
  'jason derulo',
  'ne-yo',
  'the chainsmokers',
  'calvin harris',
  'david guetta',
  'avicii',
  'marshmello',
  'alan walker',
  'nsync',
  'n sync',
  'backstreet boys',
  'spice girls',
  'westlife',
  'take that',
  'boyz ii men',
  'boyz 2 men',
  'destinys child',
  'destiny s child',
  'tlc',
  'new kids on the block',
  'jonas brothers',
  '5 seconds of summer',
  '5sos',
  'little mix',
  'fifth harmony',
  'one republic',
  'fall out boy',
  'panic at the disco',
  'my chemical romance',
  'blink 182',
  'oasis',
  'gorillaz',
  'muse',
  'u2',
  'abba',
  'ac dc',
  'guns n roses',
  'led zeppelin',
  'pink floyd',
  'rolling stones',
  'the rolling stones',
  'eagles',
  'fleetwood mac',
  'journey',
  'bon jovi',
  'aerosmith',
  'van halen',
  'pearl jam',
  'weezer',
  'sum 41',
  'simple plan',
  'good charlotte',
  'all time low',
  'bring me the horizon',
  'a day to remember',
  'nickelback',
  'evanescence',
  '3 doors down',
  'creed',
  'incubus',
  'korn',
  'slipknot',
];

const VERSION_CORE =
  '(?:official\\s+)?(?:rock|acoustic|live|remix(?:ed)?|remaster(?:ed)?|deluxe|extended|radio|clean|explicit|slowed(?:\\s*(?:\\+\\s*)?reverb)?|sped\\s*up|nightcore|instrumental|karaoke|cover|bonus|demo|unplugged|stripped|studio)';
const VERSION_TAIL = '(?:\\s*(?:version|ver\\.?|edit|mix))?';
const VERSION_SUFFIXES = [
  new RegExp(`\\s*[-–—:,]\\s*${VERSION_CORE}${VERSION_TAIL}\\s*$`, 'i'),
  new RegExp(`\\s*[(\\[]\\s*${VERSION_CORE}${VERSION_TAIL}\\s*[)\\]]\\s*$`, 'i'),
  new RegExp(`\\s+${VERSION_CORE}\\s+(?:version|ver\\.?|edit|mix)\\s*$`, 'i'),
];

const DECORATION_TOKENS = [
  'rockversion',
  'rockver',
  'acousticversion',
  'liveversion',
  'remix',
  'remixed',
  'remastered',
  'remaster',
  'version',
  'ver',
  'official',
  'acoustic',
  'instrumental',
  'karaoke',
  'unplugged',
  'nightcore',
  'slowed',
  'reverb',
  'deluxe',
  'extended',
  'explicit',
  'clean',
  'cover',
  'bonus',
  'demo',
  'studio',
  'radio',
  'edit',
  'mix',
  'live',
  'music',
  'band',
  'ost',
  'ph',
  'usa',
  'uk',
  'us',
  'nz',
  'au',
  'ca',
  'jp',
  'kr',
  'id',
  'my',
  'sg',
].sort((a, b) => b.length - a.length);

export function artistKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function artistMatchKey(value: string): string {
  return artistKey(value).replace(/\s+/g, '');
}

const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'da',
  'de',
  'del',
  'for',
  'from',
  'in',
  'n',
  'ni',
  'nor',
  'of',
  'on',
  'or',
  'the',
  'to',
  'van',
  'von',
  'vs',
  'with',
]);

function hasIntentionalCasing(value: string): boolean {
  const letters = value.replace(/[^A-Za-z]/g, '');
  return letters.length > 0 && /[a-z]/.test(letters) && /[A-Z]/.test(letters);
}

function titleCaseArtistName(value: string): string {
  if (!value || hasIntentionalCasing(value)) return value;

  return value.replace(/[^\s]+/g, (word, offset) => {
    const bare = word.toLowerCase().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    const keepSmall = offset > 0 && SMALL_WORDS.has(bare);
    return word.replace(/[A-Za-z0-9]+/g, (part) => {
      if (keepSmall) return part.toLowerCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    });
  });
}

export function canonicalArtistName(value: string): string {
  let text = value.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i += 1) {
    let next = text;
    for (const pattern of VERSION_SUFFIXES) {
      next = next.replace(pattern, '').trim();
    }
    next = next.replace(/\s*[-–—:,]+\s*$/, '').trim();
    next = next.replace(/\s*[(\[]\s*[)\]]\s*$/, '').trim();
    if (next === text) break;
    text = next;
  }
  const cleaned = text || value.trim();
  return titleCaseArtistName(cleaned);
}

export function artistGroupKey(value: string): string {
  return artistMatchKey(canonicalArtistName(value));
}

function isDecorationRemainder(extra: string): boolean {
  let rest = extra;
  if (!rest) return false;
  while (rest.length > 0) {
    const token = DECORATION_TOKENS.find((item) => rest.startsWith(item));
    if (!token) return false;
    rest = rest.slice(token.length);
  }
  return true;
}

function shouldMergeArtistKeys(left: string, right: string): boolean {
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length < 8 || !longer.startsWith(shorter)) return false;
  return isDecorationRemainder(longer.slice(shorter.length));
}

function pickClusterName(names: Map<string, number>): string {
  return [...names.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0].length - a[0].length;
  })[0][0];
}

export function buildArtistCanonicalMap(names: string[]): Map<string, string> {
  const clusters = new Map<string, Map<string, number>>();

  for (const name of names) {
    const cleaned = canonicalArtistName(name);
    const key = artistMatchKey(cleaned);
    if (!key) continue;
    const counts = clusters.get(key) ?? new Map<string, number>();
    counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
    clusters.set(key, counts);
  }

  const keys = [...clusters.keys()];
  const parent = new Map(keys.map((key) => [key, key]));

  const find = (key: string): string => {
    let current = key;
    while (parent.get(current) !== current) current = parent.get(current)!;
    parent.set(key, current);
    return current;
  };

  const keySet = new Set(keys);
  for (const longerKey of keys) {
    for (let prefixLength = 8; prefixLength < longerKey.length; prefixLength += 1) {
      const shorterKey = longerKey.slice(0, prefixLength);
      if (!keySet.has(shorterKey) || !shouldMergeArtistKeys(shorterKey, longerKey)) continue;
      const left = find(shorterKey);
      const right = find(longerKey);
      if (left === right) continue;
      if (left.length <= right.length) parent.set(right, left);
      else parent.set(left, right);
    }
  }

  const namesByRoot = new Map<string, Map<string, number>>();
  for (const key of keys) {
    const root = find(key);
    const merged = namesByRoot.get(root) ?? new Map<string, number>();
    for (const [name, count] of clusters.get(key) ?? []) {
      merged.set(name, (merged.get(name) ?? 0) + count);
    }
    namesByRoot.set(root, merged);
  }

  const displayByRoot = new Map<string, string>();
  for (const [root, counts] of namesByRoot) {
    displayByRoot.set(root, pickClusterName(counts));
  }

  const result = new Map<string, string>();
  for (const key of keys) {
    result.set(key, displayByRoot.get(find(key)) ?? key);
  }
  return result;
}

export function clusteredArtistName(artist: string, canonicalMap: Map<string, string>): string {
  const cleaned = canonicalArtistName(artist);
  return canonicalMap.get(artistMatchKey(cleaned)) ?? cleaned;
}
