import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  hasDigit,
  hasLowercaseLetter,
  hasPasswordMinLength,
  hasSpecialCharacter,
  hasUppercaseLetter,
  isPasswordValidForRegistration,
} from './password-validation.util';

describe('password validation helpers', () => {
  it('exports min length constant', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
  });

  it('hasPasswordMinLength', () => {
    expect(hasPasswordMinLength('12345')).toBe(false);
    expect(hasPasswordMinLength('123456')).toBe(true);
  });

  it('hasUppercaseLetter', () => {
    expect(hasUppercaseLetter('a')).toBe(false);
    expect(hasUppercaseLetter('A')).toBe(true);
  });

  it('hasLowercaseLetter', () => {
    expect(hasLowercaseLetter('A')).toBe(false);
    expect(hasLowercaseLetter('a')).toBe(true);
  });

  it('hasDigit', () => {
    expect(hasDigit('abc')).toBe(false);
    expect(hasDigit('a1')).toBe(true);
  });

  it('hasSpecialCharacter', () => {
    expect(hasSpecialCharacter('abc123Aa')).toBe(false);
    expect(hasSpecialCharacter('abc123Aa!')).toBe(true);
  });

  it('isPasswordValidForRegistration', () => {
    expect(isPasswordValidForRegistration('weak')).toBe(false);
    expect(isPasswordValidForRegistration('Aa1!aaaa')).toBe(true);
  });
});
