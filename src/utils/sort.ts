export function shuffleInPlace<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = items[index];
    items[index] = items[swap];
    items[swap] = current;
  }
  return items;
}

export function shuffled<T>(items: T[]): T[] {
  return shuffleInPlace([...items]);
}

export function lettersKey(value: string): string {
  return value.replace(/[^\p{L}]+/gu, '');
}

export function compareText(a: string, b: string) {
  const left = lettersKey(a);
  const right = lettersKey(b);
  if (left && right) {
    const byLetters = left.localeCompare(right, undefined, { sensitivity: 'base' });
    if (byLetters !== 0) return byLetters;
  } else if (left) {
    return -1;
  } else if (right) {
    return 1;
  }
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function azLetter(value: string): string {
  const letters = lettersKey(value);
  if (!letters) return '#';
  return letters[0].toLocaleUpperCase();
}

export function groupByAzLetter<T>(items: T[], getName: (item: T) => string): { title: string; data: T[] }[] {
  const sections: { title: string; data: T[] }[] = [];
  for (const item of items) {
    const title = azLetter(getName(item));
    const last = sections[sections.length - 1];
    if (last?.title === title) last.data.push(item);
    else sections.push({ title, data: [item] });
  }
  return sections;
}

export type AzFlatRow<T> =
  | { type: 'letter'; key: string; letter: string }
  | { type: 'item'; key: string; item: T };

export function flattenAzItems<T>(
  items: T[],
  getName: (item: T) => string,
  getKey: (item: T) => string,
  grouped: boolean
): AzFlatRow<T>[] {
  if (!grouped) {
    return items.map((item) => ({ type: 'item', key: getKey(item), item }));
  }
  const rows: AzFlatRow<T>[] = [];
  let last = '';
  for (const item of items) {
    const letter = azLetter(getName(item));
    if (letter !== last) {
      rows.push({ type: 'letter', key: `letter-${letter}`, letter });
      last = letter;
    }
    rows.push({ type: 'item', key: getKey(item), item });
  }
  return rows;
}

export function layoutsForRows(
  rows: { type: string }[],
  itemHeight: number,
  letterHeight: number
): { length: number; offset: number; index: number }[] {
  const layouts = new Array<{ length: number; offset: number; index: number }>(rows.length);
  let offset = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const length = rows[index].type === 'letter' ? letterHeight : itemHeight;
    layouts[index] = { length, offset, index };
    offset += length;
  }
  return layouts;
}
