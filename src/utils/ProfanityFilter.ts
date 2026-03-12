import { Filter } from 'bad-words';

const _filter = new Filter();

/** Returns true if the string contains a profane word. */
export function hasProfanity(text: string): boolean {
  try {
    return _filter.isProfane(text);
  } catch {
    return false;
  }
}

/**
 * Strips characters that aren't alphanumeric, space, hyphen, or underscore,
 * collapses runs of whitespace to a single space, trims, and enforces max length.
 * Returns an empty string if nothing valid remains.
 */
export function sanitizeName(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9 \-_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}
