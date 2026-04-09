import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TaskFormModalComponent } from './task-form-modal.component';
import { TaskBoardSmartComponent } from './task-board-smart.component';
import { TaskStateService } from './task-state.service';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, TaskBoardSmartComponent, TaskFormModalComponent],
  templateUrl: './home.component.html',
  host: {
    class: 'flex flex-col flex-1 min-h-0',
  },
})
export class HomeComponent implements OnInit {
  protected readonly taskState = inject(TaskStateService);
  protected readonly authService = inject(AuthService);

  /** Right-side archive panel: collapsed shows a narrow rail; expanded shows the list. */
  protected readonly archivePanelExpanded = signal(false);

  protected readonly archiveRailClass = computed(() => {
    const base =
      'flex shrink-0 flex-col border border-neutral-800 rounded-xl lg:rounded-l-xl lg:rounded-r-none lg:border-l lg:border-y lg:border-r-0 bg-neutral-950/90 transition-[width] duration-200 ease-out overflow-hidden min-h-0 lg:min-h-[min(100%,calc(100vh-5rem))] self-stretch';
    return this.archivePanelExpanded()
      ? `${base} w-full max-lg:max-h-80 lg:w-80`
      : `${base} lg:w-12 max-lg:h-12 max-lg:w-full`;
  });

  protected toggleArchivePanel(): void {
    const next = !this.archivePanelExpanded();
    this.archivePanelExpanded.set(next);
    if (next) {
      this.taskState.openArchive();
    }
  }

  ngOnInit(): void {
    this.taskState.loadTasks();
  }

  protected logout(): void {
    this.authService.signOutAndRedirect();
  }
}
