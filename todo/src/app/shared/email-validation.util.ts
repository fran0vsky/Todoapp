/** Frontend email shape check before hitting the API. Not a full RFC parser. */
export function isValidEmailFormat(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
