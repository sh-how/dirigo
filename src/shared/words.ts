// Copy helpers: numbers under ten are words in headlines, digits elsewhere.

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** "two" for 2, "37" for 37. */
export function word(n: number): string {
  return n >= 0 && n < 10 ? WORDS[n] : String(n);
}

/** "Two" for 2, "37" for 37. */
export function Word(n: number): string {
  const w = word(n);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Choose the singular or plural form of a word or phrase. */
export function pick(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** "M. Tanaka", "M. Tanaka and C. Okafor", "A, B and C" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
