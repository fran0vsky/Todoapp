import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { EMPTY, Subject, switchMap, takeUntil } from 'rxjs';
import { TaskFormModalComponent } from './task-form-modal.component';
import { AssignTaskModalComponent } from './assign-task-modal.component';
import { TaskBoardSmartComponent } from './task-board-smart.component';
import { TaskStateService } from './task-state.service';
import { HomeNavbarComponent } from './home-navbar.component';
import { ProjectApiService } from './project-api.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterModule,
    HomeNavbarComponent,
    TaskBoardSmartComponent,
    TaskFormModalComponent,
    AssignTaskModalComponent,
  ],
  templateUrl: './home.component.html',
  host: {
    class: 'flex flex-col flex-1 min-h-0',
  },
})
export class HomeComponent implements OnInit, OnDestroy {
  protected readonly taskState = inject(TaskStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectApi = inject(ProjectApiService);
  private readonly destroy$ = new Subject<void>();

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
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap((pm) => {
          const raw = pm.get('projectId');
          if (!raw) {
            this.router.navigate(['/']);
            return EMPTY;
          }
          const id = Number(raw);
          if (!Number.isInteger(id) || id <= 0) {
            this.router.navigate(['/']);
            return EMPTY;
          }
          return this.projectApi.getProject(id);
        })
      )
      .subscribe({
        next: (project) => {
          this.taskState.setActiveProject(project.id, project.name);
          this.taskState.loadTasks();
        },
        error: () => {
          this.router.navigate(['/']);
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.taskState.clearProjectContext();
  }
}
