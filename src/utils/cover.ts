const PALETTES = [
  ['#2563EB', '#0B1220'],
  ['#1D4ED8', '#111827'],
  ['#3B82F6', '#1E3A8A'],
  ['#0EA5E9', '#0F172A'],
  ['#6366F1', '#0B1220'],
  ['#4F46E5', '#1E1B4B'],
  ['#0284C7', '#111827'],
  ['#7C3AED', '#0F172A'],
] as const;

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function coverPalette(title: string, artist?: string): readonly [string, string] {
  const key = `${title}:${artist ?? ''}`;
  return PALETTES[hashString(key) % PALETTES.length];
}

const BRIGHT_PALETTES = [
  ['#BFDBFE', '#60A5FA', '#2563EB'],
  ['#C4B5FD', '#818CF8', '#4F46E5'],
  ['#A5F3FC', '#38BDF8', '#0284C7'],
  ['#DDD6FE', '#A78BFA', '#7C3AED'],
  ['#BAE6FD', '#38BDF8', '#1D4ED8'],
  ['#E0E7FF', '#818CF8', '#4338CA'],
  ['#99F6E4', '#22D3EE', '#0284C7'],
  ['#F5D0FE', '#C084FC', '#7C3AED'],
] as const;

export function brightCoverPalette(title: string, artist?: string): readonly [string, string, string] {
  const key = `${title}:${artist ?? ''}`;
  return BRIGHT_PALETTES[hashString(key) % BRIGHT_PALETTES.length];
}

export const PLAYLIST_ICONS = [
  { ios: 'music.note.list', android: 'queue_music', web: 'queue_music' },
  { ios: 'headphones', android: 'headphones', web: 'headphones' },
  { ios: 'star.fill', android: 'star', web: 'star' },
  { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  { ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' },
  { ios: 'radio', android: 'radio', web: 'radio' },
  { ios: 'mic.fill', android: 'mic', web: 'mic' },
  { ios: 'opticaldisc', android: 'album', web: 'album' },
  { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  { ios: 'moon.stars.fill', android: 'nights_stay', web: 'nights_stay' },
  { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
] as const;

const PLAYLIST_PALETTES = [
  ['#FB7185', '#F59E0B', '#7C3AED'],
  ['#34D399', '#22D3EE', '#2563EB'],
  ['#F472B6', '#A78BFA', '#38BDF8'],
  ['#FBBF24', '#F97316', '#EF4444'],
  ['#2DD4BF', '#84CC16', '#0EA5E9'],
  ['#C084FC', '#F472B6', '#FB7185'],
  ['#60A5FA', '#22D3EE', '#A78BFA'],
  ['#F43F5E', '#FB923C', '#F59E0B'],
  ['#4ADE80', '#2DD4BF', '#818CF8'],
  ['#E879F9', '#818CF8', '#38BDF8'],
  ['#F59E0B', '#34D399', '#06B6D4'],
  ['#FB7185', '#818CF8', '#22D3EE'],
] as const;

export function playlistCover(id: string, name: string) {
  const hash = hashString(`${id}:${name}`);
  return {
    palette: PLAYLIST_PALETTES[hash % PLAYLIST_PALETTES.length],
    icon: PLAYLIST_ICONS[hash % PLAYLIST_ICONS.length],
  };
}
