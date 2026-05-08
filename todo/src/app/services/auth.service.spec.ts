import { NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { Session, User } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service';

const sessionHolder = vi.hoisted(() => ({ session: null as Session | null }));
const authApis = vi.hoisted(() => ({
  signUpImpl: () =>
    Promise.resolve({
      data: { session: null as Session | null, user: null },
      error: null,
    }),
  signOutResolved: Promise.resolve({ error: null as Error | null }),
  updateUserResolved: Promise.resolve({
    data: {
      user: {
        id: 'u',
        aud: '',
        role: '',
        email: 'e@test.com',
        app_metadata: {},
        user_metadata: { nickname: 'Nick' },
        created_at: '',
        updated_at: '',
      } as User,
    },
    error: null,
  }),
}));

vi.mock('./supabase.client', () => ({
  getSupabase: () => ({
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: sessionHolder.session } }),
      ),
      signOut: vi.fn(() => authApis.signOutResolved),
      signUp: vi.fn(() => authApis.signUpImpl()),
      signInWithPassword: vi.fn(() =>
        Promise.resolve({
          data: {
            session: sessionHolder.session,
            user: sessionHolder.session?.user ?? null,
          },
          error: null,
        }),
      ),
      updateUser: vi.fn(() => authApis.updateUserResolved),
    },
  }),
}));

function minimalSession(userOverrides: Partial<User> = {}): Session {
  return {
    access_token: 'a',
    refresh_token: 'r',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: '1',
      aud: 'x',
      role: 'authenticated',
      email: 'admin@admin.com',
      app_metadata: {},
      user_metadata: {},
      created_at: 't',
      updated_at: 't',
      ...userOverrides,
    } as User,
  };
}

function createService(navigateSpy = vi.fn()): AuthService {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: NgZone,
        useValue: { run: <T>(fn: () => T) => fn() },
      },
      AuthService,
      { provide: Router, useValue: { navigate: navigateSpy } },
    ],
  });
  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  const navigateSpy = vi.fn();

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sessionHolder.session = null;
    authApis.signOutResolved = Promise.resolve({ error: null });
    authApis.signUpImpl = () =>
      Promise.resolve({
        data: { session: null, user: null },
        error: null,
      });
    navigateSpy.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    try {
      TestBed.inject(AuthService).ngOnDestroy();
    } catch {
      /* not created */
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('isAdmin matches configured admin email', async () => {
    sessionHolder.session = minimalSession({ email: 'admin@admin.com' });
    const svc = createService(navigateSpy);
    await Promise.resolve();
    expect(svc.isAdmin()).toBe(true);
  });

  it('displayLabel prefers trimmed nickname', () => {
    sessionHolder.session = null;
    const svc = createService(navigateSpy);
    const u1 = {
      email: 'a@b.co',
      user_metadata: { nickname: '  bob  ' },
    } as unknown as User;
    expect(svc.displayLabel(u1)).toBe('bob');
    const u2 = {
      email: 'a@b.co',
      user_metadata: { nickname: '   ' },
    } as unknown as User;
    expect(svc.displayLabel(u2)).toBe('a@b.co');
    expect(svc.displayLabel(null)).toBe('');
    const u3 = {
      email: 'a@b.co',
      user_metadata: { nickname: 1 },
    } as unknown as User;
    expect(svc.displayLabel(u3)).toBe('a@b.co');
  });

  it('nicknameFromMetadata', () => {
    sessionHolder.session = null;
    const svc = createService(navigateSpy);
    const u = { user_metadata: { nickname: 'n' } } as unknown as User;
    expect(svc.nicknameFromMetadata(u)).toBe('n');
    expect(svc.nicknameFromMetadata(null)).toBe('');
  });

  it('signIn starts session timer that logs out', async () => {
    sessionHolder.session = minimalSession();
    const svc = createService(navigateSpy);
    await Promise.resolve();
    await firstValueFrom(svc.signIn('x@y.co', 'pw'));
    vi.advanceTimersByTime(3600 * 1000 + 1);
    await Promise.resolve();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('signUp starts timer when response includes session', async () => {
    const sess = minimalSession();
    authApis.signUpImpl = () =>
      Promise.resolve({
        data: { session: sess, user: sess.user },
        error: null,
      });
    const svc = createService(navigateSpy);
    await Promise.resolve();
    await firstValueFrom(svc.signUp('n@n.co', 'Pw1!aaaa'));
    vi.advanceTimersByTime(3600 * 1000 + 1);
    await Promise.resolve();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('signOutAndRedirect navigates on success and on error', async () => {
    sessionHolder.session = null;
    const svc = createService(navigateSpy);
    authApis.signOutResolved = Promise.resolve({ error: null });
    svc.signOutAndRedirect();
    await Promise.resolve();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    navigateSpy.mockClear();
    authApis.signOutResolved = Promise.reject(new Error('net'));
    svc.signOutAndRedirect();
    await Promise.resolve();
    await Promise.resolve();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('updateNickname maps user into currentUser', async () => {
    authApis.updateUserResolved = Promise.resolve({
      data: {
        user: {
          id: 'u2',
          aud: '',
          role: '',
          email: 'z@z.co',
          app_metadata: {},
          user_metadata: { nickname: 'Hi' },
          created_at: '',
          updated_at: '',
        } as User,
      },
      error: null,
    });
    sessionHolder.session = null;
    const svc = createService(navigateSpy);
    await firstValueFrom(svc.updateNickname(' Hi '));
    expect(svc.currentUser()?.user_metadata?.['nickname']).toBe('Hi');
  });

  it('updateNickname throws when API returns error', async () => {
    sessionHolder.session = null;
    const svc = createService(navigateSpy);
    authApis.updateUserResolved = Promise.resolve({
      data: { user: null as unknown as User },
      error: { message: 'bad' } as Error,
    });
    await expect(firstValueFrom(svc.updateNickname('x'))).rejects.toBeDefined();
  });

  it('signOut returns observable from supabase', async () => {
    sessionHolder.session = null;
    const svc = createService(navigateSpy);
    const r = await firstValueFrom(svc.signOut());
    expect(r.error).toBeNull();
  });
});
