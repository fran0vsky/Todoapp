import { NgClass } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Project } from '../models/project.model';
import { ProjectApiService } from '../services/project-api.service';
import { AuthService } from '../services/auth.service';
import { HomeNavbarComponent } from './home-navbar.component';

@Component({
  selector: 'app-projects-list',
  imports: [RouterModule, HomeNavbarComponent, NgClass],
  templateUrl: './projects-list.component.html',
  host: {
    class:
      'flex flex-col flex-1 min-h-0 bg-black text-white px-6 pt-3 pb-6 md:px-10 md:pt-4 md:pb-10',
  },
})
export class ProjectsListComponent implements OnInit {
  private readonly projectApi = inject(ProjectApiService);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService);

  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly newProjectName = signal('');
  protected readonly creating = signal(false);
  protected readonly deletingId = signal<number | null>(null);

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.projectApi.getProjects().subscribe({
      next: (list) => {
        this.projects.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  protected onNameInput(value: string): void {
    this.newProjectName.set(value);
  }

  protected createProject(): void {
    const name = this.newProjectName().trim();
    if (!name || this.creating()) return;
    this.creating.set(true);
    this.projectApi.createProject({ name }).subscribe({
      next: (project) => {
        this.creating.set(false);
        this.newProjectName.set('');
        this.router.navigate(['/p', project.id]);
      },
      error: () => {
        this.creating.set(false);
      },
    });
  }

  protected viewProject(id: number): void {
    this.router.navigate(['/p', id]);
  }

  protected deleteProject(project: Project, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.authService.isAdmin()) {
      return;
    }
    if (
      !confirm(
        `Delete “${project.name}” and all of its tasks? This cannot be undone.`,
      )
    ) {
      return;
    }
    this.deletingId.set(project.id);
    this.projectApi.deleteProject(project.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.refresh();
      },
      error: (err: unknown) => {
        this.deletingId.set(null);
        let msg = 'Could not delete project.';
        if (err instanceof HttpErrorResponse) {
          const body = err.error;
          if (typeof body === 'object' && body !== null && 'error' in body) {
            msg = String((body as { error: string }).error);
          } else if (err.message) {
            msg = err.message;
          }
        } else if (err instanceof Error) {
          msg = err.message;
        }
        alert(msg);
      },
    });
  }
}
