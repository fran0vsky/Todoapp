import { describe, expect, it } from 'vitest';
import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('defines login register and guarded board routes', () => {
    const paths = appRoutes.map((r) => r.path);
    expect(paths).toContain('');
    expect(paths).toContain('p/:projectId');
    expect(paths).toContain('login');
    expect(paths).toContain('register');
  });
});
