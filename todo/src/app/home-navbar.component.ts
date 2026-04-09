import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-home-navbar',
  imports: [RouterModule],
  templateUrl: './home-navbar.component.html',
  host: {
    class: 'block shrink-0 w-full border-b border-neutral-800/80 pb-2 mb-3',
  },
})
export class HomeNavbarComponent {
  protected readonly authService = inject(AuthService);

  protected logout(): void {
    this.authService.signOutAndRedirect();
  }
}
