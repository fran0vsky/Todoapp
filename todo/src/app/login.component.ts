import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    // Redirect to home if already logged in
    if (this.authService.currentUser()) {
      this.router.navigate(['/']);
    }
  }

  onSubmit(): void {
    this.errorMessage.set(null);

    this.authService.signIn(this.email, this.password).subscribe({
      next: (response) => {
        if (response.error) {
          this.errorMessage.set(response.error.message);
        } else if (response.data.user) {
          this.router.navigate(['/']);
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
