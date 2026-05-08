import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterComponent } from './register.component';
import { AuthService } from '../services/auth.service';

const VALID_PASSWORD = 'Aa1!xx';

describe('RegisterComponent', () => {
  const signUp = vi.fn();
  const signIn = vi.fn();

  beforeEach(() => {
    signUp.mockReset();
    signIn.mockReset();
    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: () => null,
            signUp: (...args: [string, string]) => signUp(...args),
            signIn: (...args: [string, string]) => signIn(...args),
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('registerDisabled reflects registration rules', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const cmp = fixture.componentInstance as unknown as {
      email: string;
      password: string;
      registerDisabled(): boolean;
    };
    cmp.email = '';
    cmp.password = '';
    expect(cmp.registerDisabled()).toBe(true);
    cmp.email = 'a@b.co';
    cmp.password = 'short';
    expect(cmp.registerDisabled()).toBe(true);
    cmp.password = VALID_PASSWORD;
    expect(cmp.registerDisabled()).toBe(false);
  });

  it('navigates home after sign-up and auto sign-in success', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    signUp.mockReturnValue(
      of({
        error: null,
        data: { user: { id: 'u' } as never },
      }),
    );
    signIn.mockReturnValue(
      of({
        error: null,
        data: { session: { access_token: 't' } as never, user: null },
      }),
    );
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.componentInstance.email = 'a@b.co';
    fixture.componentInstance.password = VALID_PASSWORD;
    fixture.detectChanges();
    fixture.componentInstance.onSubmit();
    expect(signUp).toHaveBeenCalled();
    expect(signIn).toHaveBeenCalledWith('a@b.co', VALID_PASSWORD);
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('sets error when signUp fails', () => {
    signUp.mockReturnValue(
      of({
        error: { message: 'Email taken' },
        data: { user: null },
      }),
    );
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.componentInstance.email = 'a@b.co';
    fixture.componentInstance.password = VALID_PASSWORD;
    fixture.detectChanges();
    fixture.componentInstance.onSubmit();
    expect(fixture.componentInstance.errorMessage()).toBe('Email taken');
  });

  it('sets error on network failure', () => {
    signUp.mockReturnValue(throwError(() => new Error('net')));
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.componentInstance.email = 'a@b.co';
    fixture.componentInstance.password = VALID_PASSWORD;
    fixture.detectChanges();
    fixture.componentInstance.onSubmit();
    expect(fixture.componentInstance.errorMessage()).toBe('net');
  });
});
