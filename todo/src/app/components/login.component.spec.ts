import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../services/auth.service';

describe('LoginComponent', () => {
  const signIn = vi.fn();

  beforeEach(() => {
    signIn.mockReset();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: () => null,
            signIn: (...args: [string, string]) => signIn(...args),
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loginDisabled reflects email and password validation', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const cmp = fixture.componentInstance as unknown as {
      email: string;
      password: string;
      loginDisabled(): boolean;
    };
    cmp.email = '';
    cmp.password = '';
    expect(cmp.loginDisabled()).toBe(true);
    cmp.email = 'a@b.co';
    cmp.password = '';
    expect(cmp.loginDisabled()).toBe(true);
    cmp.password = 'secret';
    expect(cmp.loginDisabled()).toBe(false);
  });

  it('shows email validation border after typing invalid email', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const emailInput = fixture.nativeElement.querySelector(
      '#email',
    ) as HTMLInputElement;
    emailInput.value = 'not-an-email';
    emailInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(emailInput.className).toMatch(/border-red-500/);
  });

  it('navigates home on successful sign-in', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    signIn.mockReturnValue(
      of({
        error: null,
        data: { user: { id: 'u' } as never },
      }),
    );
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.email = 'a@b.co';
    fixture.componentInstance.password = 'secret';
    fixture.detectChanges();
    fixture.componentInstance.onSubmit();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('sets error message when sign-in returns error', () => {
    signIn.mockReturnValue(
      of({
        error: { message: 'Bad creds' },
        data: { user: null },
      }),
    );
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.email = 'a@b.co';
    fixture.componentInstance.password = 'secret';
    fixture.detectChanges();
    fixture.componentInstance.onSubmit();
    expect(fixture.componentInstance.errorMessage()).toBe('Bad creds');
  });

  it('sets error message on sign-in observer error', () => {
    signIn.mockReturnValue(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.email = 'a@b.co';
    fixture.componentInstance.password = 'secret';
    fixture.detectChanges();
    fixture.componentInstance.onSubmit();
    expect(fixture.componentInstance.errorMessage()).toBe('offline');
  });
});
