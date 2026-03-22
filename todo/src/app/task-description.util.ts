/**
 * True when the stored description has visible text (handles HTML / rich text).
 */
export function hasTaskDescription(value: string | null | undefined): boolean {
  const raw = (value ?? '').trim();
  if (!raw) return false;
  const text = raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .trim();
  return text.length > 0;
}
