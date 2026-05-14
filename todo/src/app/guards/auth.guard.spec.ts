import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  it('allows when user present and auth already checked', () => {
    const router = { createUrlTree: vi.fn() } as unknown as Router;
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        {
          provide: AuthService,
          useValue: {
            authChecked: signal(true),
            currentUser: signal({} as User),
          },
        },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    expect(result).toBe(true);
  });

  it('redirects to login when logged out and auth already checked', () => {
    const tree = {} as UrlTree;
    const router = { createUrlTree: vi.fn(() => tree) } as unknown as Router;
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        {
          provide: AuthService,
          useValue: {
            authChecked: signal(true),
            currentUser: signal(null),
          },
        },
      ],
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, {} as never),
    );
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(tree);
  });

  it('waits for authChecked then allows when session is restored', async () => {
    const router = { createUrlTree: vi.fn() } as unknown as Router;
    const authChecked = signal(false);
    const currentUser = signal({} as User);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { authChecked, currentUser } },
      ],
    });

    const resultPromise = TestBed.runInInjectionContext(() =>
      firstValueFrom(
        authGuard({} as never, {} as never) as ReturnType<
          typeof firstValueFrom
        >,
      ),
    );

    // Simulate getSession() resolving after a tick
    authChecked.set(true);
    TestBed.flushEffects();

    const result = await resultPromise;
    expect(result).toBe(true);
  });

  it('waits for authChecked then redirects when no session', async () => {
    const tree = {} as UrlTree;
    const router = { createUrlTree: vi.fn(() => tree) } as unknown as Router;
    const authChecked = signal(false);
    const currentUser = signal<User | null>(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { authChecked, currentUser } },
      ],
    });

    const resultPromise = TestBed.runInInjectionContext(() =>
      firstValueFrom(
        authGuard({} as never, {} as never) as ReturnType<
          typeof firstValueFrom
        >,
      ),
    );

    authChecked.set(true);
    TestBed.flushEffects();

    const result = await resultPromise;
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(tree);
  });
});
