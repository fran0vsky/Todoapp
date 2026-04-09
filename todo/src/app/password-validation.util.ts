/** Minimum length for registration passwords (frontend rule). */
export const PASSWORD_MIN_LENGTH = 6;

export function hasPasswordMinLength(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}

export function hasUppercaseLetter(password: string): boolean {
  return /[A-Z]/.test(password);
}

export function hasLowercaseLetter(password: string): boolean {
  return /[a-z]/.test(password);
}

export function hasDigit(password: string): boolean {
  return /[0-9]/.test(password);
}

/** At least one character that is not a letter, digit, or whitespace (symbol / punctuation). */
export function hasSpecialCharacter(password: string): boolean {
  return /[^a-zA-Z0-9\s]/.test(password);
}

export function isPasswordValidForRegistration(password: string): boolean {
  return (
    hasPasswordMinLength(password) &&
    hasUppercaseLetter(password) &&
    hasLowercaseLetter(password) &&
    hasDigit(password) &&
    hasSpecialCharacter(password)
  );
}
