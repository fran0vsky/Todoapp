import { computed, Injectable, inject, NgZone, OnDestroy, signal } from '@angular/core';
import { from, Observable, Subscription, timer } from 'rxjs';
import { AuthResponse, User, Session, UserResponse } from '@supabase/supabase-js';
import { getSupabase } from './supabase.client';
import { ADMIN_EMAIL } from './admin.config';
import { map, tap } from 'rxjs/operators';
import { Router } from '@angular/router';

const NICKNAME_META_KEY = 'nickname';
const MAX_NICKNAME_LENGTH = 40;

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  readonly currentUser = signal<User | null>(null);

  /** Matches server ADMIN_EMAIL; used to enable admin-only UI (e.g. delete project). */
  readonly isAdmin = computed(() => {
    const e = this.currentUser()?.email?.trim().toLowerCase();
    return e === ADMIN_EMAIL.toLowerCase();
  });
  private readonly ngZone = inject(NgZone);
  private readonly router = inject(Router);

  private sessionTimerSubscription: Subscription | null = null;
  private readonly SESSION_TIMEOUT_SECONDS = 3600; // FOR TESTING: 10 seconds. Set to 3600 for 1 hour.

  constructor() {
    getSupabase().auth.onAuthStateChange((event, session) => {
      this.ngZone.run(() => {
        this.currentUser.set(session?.user ?? null);
        if (session) {
          console.log('[AuthService] Auth state changed: session received.', event, session);
          this.startSessionTimer(session);
        } else {
          console.log('[AuthService] Auth state changed: no session or logged out.', event);
          this.stopSessionTimer();
        }
      });
    });

    // Check current session on service init (e.g., page refresh)
    from(getSupabase().auth.getSession()).subscribe(({ data: { session } }) => {
      this.ngZone.run(() => {
        this.currentUser.set(session?.user ?? null);
        if (session) {
          console.log('[AuthService] Initial session check: session found.', session);
          this.startSessionTimer(session);
        } else {
          console.log('[AuthService] Initial session check: no session.');
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.stopSessionTimer();
  }

  private startSessionTimer(session: Session): void {
    this.stopSessionTimer(); // Always stop existing timer before starting a new one

    const timeoutSeconds = this.SESSION_TIMEOUT_SECONDS;
    const timeoutMs = timeoutSeconds * 1000;

    const supabaseExpiresAt = session.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : 'N/A';
    const now = new Date().toLocaleString();

    console.log(`[AuthService] Starting session timer for ${timeoutSeconds} seconds.`);
    console.log(`[AuthService] Current time: ${now}`);
    console.log(`[AuthService] Supabase session (JWT) expires at: ${supabaseExpiresAt} (in ${session.expires_in} seconds).`);
    console.log(`[AuthService] User: ${session.user?.email}`);

    this.sessionTimerSubscription = timer(timeoutMs)
      .pipe(
        tap(() => {
          console.log('[AuthService] --- Client-side timer triggered. Initiating logout. ---');
          this.ngZone.run(() => this.signOutAndRedirect());
        })
      )
      .subscribe(() => {
        console.log('[AuthService] Timer subscription completed.');
      });

    console.log('[AuthService] Timer subscription started.');
  }

  private stopSessionTimer(): void {
    if (this.sessionTimerSubscription && !this.sessionTimerSubscription.closed) {
      this.sessionTimerSubscription.unsubscribe();
      this.sessionTimerSubscription = null;
      console.log('[AuthService] Session timer stopped via unsubscribe.');
    } else {
      console.log('[AuthService] No active session timer to stop.');
    }
  }

  signUp(email: string, password: string): Observable<AuthResponse> {
    return from(getSupabase().auth.signUp({ email, password })).pipe(
      tap(response => {
        if (response.data.session) {
          console.log('[AuthService] Sign up successful. Starting timer.');
          this.ngZone.run(() => this.startSessionTimer(response.data.session!));
        }
      })
    );
  }

  signIn(email: string, password: string): Observable<AuthResponse> {
    return from(getSupabase().auth.signInWithPassword({ email, password })).pipe(
      tap(response => {
        if (response.data.session) {
          console.log('[AuthService] Sign in successful. Starting timer.');
          this.ngZone.run(() => this.startSessionTimer(response.data.session!));
        }
      })
    );
  }

  signOut(): Observable<{ error: Error | null }> {
    return from(getSupabase().auth.signOut());
  }

  /** Shown in the UI: trimmed nickname if set, otherwise email. */
  displayLabel(user: User | null): string {
    if (!user) return '';
    const raw = user.user_metadata?.[NICKNAME_META_KEY];
    if (typeof raw === 'string') {
      const t = raw.trim();
      if (t.length > 0) return t;
    }
    return user.email ?? '';
  }

  /** Current nickname value for editing (may be empty). */
  nicknameFromMetadata(user: User | null): string {
    if (!user) return '';
    const raw = user.user_metadata?.[NICKNAME_META_KEY];
    return typeof raw === 'string' ? raw : '';
  }

  updateNickname(nickname: string): Observable<UserResponse> {
    const trimmed = nickname.trim().slice(0, MAX_NICKNAME_LENGTH);
    return from(
      getSupabase().auth.updateUser({
        data: { [NICKNAME_META_KEY]: trimmed.length > 0 ? trimmed : null },
      })
    ).pipe(
      map((res) => {
        if (res.error) throw res.error;
        if (res.data.user) {
          this.ngZone.run(() => this.currentUser.set(res.data.user));
        }
        return res;
      })
    );
  }

  signOutAndRedirect(): void {
    console.log('[AuthService] signOutAndRedirect: Attempting to sign out and navigate.');
    this.signOut().subscribe({
      next: () => {
        console.log('[AuthService] signOutAndRedirect: Sign out successful. Navigating to /login.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('[AuthService] signOutAndRedirect: Error during sign out:', err);
        this.router.navigate(['/login']); // Still attempt to navigate to unblock
      }
    });
  }
}
