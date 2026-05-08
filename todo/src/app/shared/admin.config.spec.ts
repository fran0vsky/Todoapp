import { describe, expect, it } from 'vitest';
import { ADMIN_EMAIL } from './admin.config';

describe('ADMIN_EMAIL', () => {
  it('matches expected default admin', () => {
    expect(ADMIN_EMAIL).toBe('admin@admin.com');
  });
});
