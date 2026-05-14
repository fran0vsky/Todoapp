import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, take, map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allow = () =>
    authService.currentUser() ? true : router.createUrlTree(['/login']);

  // If the initial getSession() has already resolved, decide immediately.
  if (authService.authChecked()) {
    return allow();
  }

  // Otherwise wait for getSession() to complete, then decide.
  // This prevents the guard from redirecting to /login before the stored
  // session token from localStorage has been read by the Supabase client.
  return toObservable(authService.authChecked).pipe(
    filter(Boolean),
    take(1),
    map(allow),
  );
};
