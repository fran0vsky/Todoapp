import { describe, expect, it } from 'vitest';
import { isSimpleEmail, isTaskStatus, parseEstimate } from './validation';

describe('validation', () => {
  describe('parseEstimate', () => {
    it('treats undefined and null as unset', () => {
      expect(parseEstimate(undefined)).toEqual({ ok: true, value: null });
      expect(parseEstimate(null)).toEqual({ ok: true, value: null });
    });

    it('accepts Fibonacci values', () => {
      for (const n of [1, 2, 3, 5, 8]) {
        expect(parseEstimate(n)).toEqual({ ok: true, value: n });
      }
    });

    it('rejects non-integers and values outside Fibonacci', () => {
      expect(parseEstimate(1.2).ok).toBe(false);
      expect(parseEstimate(4).ok).toBe(false);
      expect(parseEstimate('3' as unknown as number).ok).toBe(false);
    });
  });

  describe('isSimpleEmail', () => {
    it('accepts basic shapes', () => {
      expect(isSimpleEmail('a@b.co')).toBe(true);
      expect(isSimpleEmail('user.name+tag@example.com')).toBe(true);
    });

    it('rejects invalid', () => {
      expect(isSimpleEmail('')).toBe(false);
      expect(isSimpleEmail('nope')).toBe(false);
      expect(isSimpleEmail('a @b.co')).toBe(false);
    });
  });

  describe('isTaskStatus', () => {
    it('narrows to todo | doing | done', () => {
      expect(isTaskStatus('todo')).toBe(true);
      expect(isTaskStatus('doing')).toBe(true);
      expect(isTaskStatus('done')).toBe(true);
      expect(isTaskStatus('blocked')).toBe(false);
      expect(isTaskStatus(1)).toBe(false);
    });
  });
});
