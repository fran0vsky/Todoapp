import { Injectable, signal } from '@angular/core';
import { from, Observable } from 'rxjs';
import { AuthResponse, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<User | null>(null);

  constructor() {
    supabase.auth.onAuthStateChange((_event, session) => {
      this.currentUser.set(session?.user ?? null);
    });
  }

  signUp(email: string, password: string): Observable<AuthResponse> {
    return from(supabase.auth.signUp({ email, password }));
  }

  signIn(email: string, password: string): Observable<AuthResponse> {
    return from(supabase.auth.signInWithPassword({ email, password }));
  }

  signOut(): Observable<{ error: Error | null }> {
    return from(supabase.auth.signOut());
  }
}
