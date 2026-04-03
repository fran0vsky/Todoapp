import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);

  email = '';
  password = '';
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  onSubmit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.authService.signUp(this.email, this.password).subscribe({
      next: (response) => {
        if (response.error) {
          this.errorMessage.set(response.error.message);
        } else if (response.data.user) {
          this.successMessage.set('Registration successful! Check your email for a confirmation link.');
          this.email = '';
          this.password = '';
        } else {
          this.errorMessage.set('An unexpected error occurred.');
        }
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Network error occurred.');
      },
    });
  }
}
