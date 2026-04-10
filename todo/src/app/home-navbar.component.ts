import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from './auth.service';
import { TaskStateService } from './task-state.service';

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
  private readonly taskState = inject(TaskStateService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly panelOpen = signal(false);
  protected readonly nicknameDraft = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected togglePanel(event: MouseEvent): void {
    event.stopPropagation();
    const next = !this.panelOpen();
    this.panelOpen.set(next);
    if (next) {
      this.nicknameDraft.set(this.authService.nicknameFromMetadata(this.authService.currentUser()!));
      this.saveError.set(null);
    }
  }

  protected closePanel(): void {
    this.panelOpen.set(false);
  }

  protected onNicknameInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.nicknameDraft.set(v.slice(0, 40));
  }

  protected saveNickname(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.authService.updateNickname(this.nicknameDraft()).subscribe({
      next: () => {
        this.saving.set(false);
        this.panelOpen.set(false);
        this.taskState.refreshAssignableUsers().subscribe();
      },
      error: (err: Error) => {
        this.saving.set(false);
        this.saveError.set(err.message || 'Could not save nickname.');
      },
    });
  }

  protected logout(): void {
    this.panelOpen.set(false);
    this.authService.signOutAndRedirect();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(ev: MouseEvent): void {
    if (!this.panelOpen()) return;
    if (!this.host.nativeElement.contains(ev.target as Node)) {
      this.panelOpen.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape' && this.panelOpen()) {
      this.panelOpen.set(false);
    }
  }
}
