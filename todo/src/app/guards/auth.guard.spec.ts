import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  it('allows when user present', () => {
    const router = { createUrlTree: vi.fn() } as unknown as Router;
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { currentUser: () => ({}) as User } },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    expect(result).toBe(true);
  });

  it('redirects to login when logged out', () => {
    const tree = {} as UrlTree;
    const router = { createUrlTree: vi.fn(() => tree) } as unknown as Router;
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { currentUser: () => null } },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(tree);
  });
});
