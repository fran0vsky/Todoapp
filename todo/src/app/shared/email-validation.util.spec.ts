import { describe, expect, it } from 'vitest';
import { isValidEmailFormat } from './email-validation.util';

describe('isValidEmailFormat', () => {
  it('returns false for empty', () => {
    expect(isValidEmailFormat('')).toBe(false);
    expect(isValidEmailFormat('   ')).toBe(false);
  });

  it('returns false for malformed', () => {
    expect(isValidEmailFormat('a')).toBe(false);
    expect(isValidEmailFormat('a@b')).toBe(false);
    expect(isValidEmailFormat('@b.com')).toBe(false);
  });

  it('returns true for simple valid email', () => {
    expect(isValidEmailFormat(' a@b.co ')).toBe(true);
  });
});
