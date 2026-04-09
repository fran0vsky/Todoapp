import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './auth.service';
import { isValidEmailFormat } from './email-validation.util';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  /** True after the user has typed in the email field (validation UI only). */
  protected readonly emailDirty = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  isLoading = signal(false);

  ngOnInit(): void {
    // Redirect to home if already logged in
    if (this.authService.currentUser()) {
      this.router.navigate(['/']);
    }
  }

  protected onEmailInput(): void {
    this.emailDirty.set(true);
  }

  protected showEmailInvalid(): boolean {
    return this.emailDirty() && !isValidEmailFormat(this.email);
  }

  protected registerDisabled(): boolean {
    return this.isLoading() || !isValidEmailFormat(this.email) || !this.password.trim();
  }

  onSubmit(): void {
    if (!isValidEmailFormat(this.email) || !this.password.trim()) {
      return;
    }
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isLoading.set(true);

    this.authService.signUp(this.email, this.password).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (response) => {
        if (response.error) {
          this.errorMessage.set(response.error.message);
        } else if (response.data.user) {
          // Registration successful, now auto-login
          console.log('[RegisterComponent] Registration successful, attempting auto-login.');
          this.authService.signIn(this.email, this.password).subscribe({
            next: (signInResponse) => {
              if (signInResponse.error) {
                this.errorMessage.set('Registration successful, but auto-login failed: ' + signInResponse.error.message);
              } else if (signInResponse.data.session) {
                console.log('[RegisterComponent] Auto-login successful. Redirecting to home.');
                this.router.navigate(['/']);
              } else {
                this.errorMessage.set('Registration successful, but an unexpected auto-login error occurred.');
              }
            },
            error: (signInError) => {
              this.errorMessage.set('Registration successful, but auto-login network error: ' + signInError.message);
            }
          });
        } else {
          this.errorMessage.set('An unexpected error occurred during registration.');
        }
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Network error during registration.');
      },
    });
  }
}
