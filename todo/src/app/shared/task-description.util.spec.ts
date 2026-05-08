import { describe, expect, it } from 'vitest';
import { hasTaskDescription } from './task-description.util';

describe('hasTaskDescription', () => {
  it('handles nullish and blanks', () => {
    expect(hasTaskDescription(null)).toBe(false);
    expect(hasTaskDescription(undefined)).toBe(false);
    expect(hasTaskDescription('')).toBe(false);
    expect(hasTaskDescription('   ')).toBe(false);
  });

  it('strips tags and nbsp', () => {
    expect(hasTaskDescription('<p></p>')).toBe(false);
    expect(hasTaskDescription('<p>&nbsp;</p>')).toBe(false);
    expect(hasTaskDescription('<p>hi</p>')).toBe(true);
    expect(hasTaskDescription('\u00a0x')).toBe(true);
  });
});
