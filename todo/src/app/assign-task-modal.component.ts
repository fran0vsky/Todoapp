import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TaskStateService } from './task-state.service';
import { TaskApiService } from './task-api.service';

@Component({
  selector: 'app-assign-task-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './assign-task-modal.component.html',
  host: {
    class: 'contents',
  },
})
export class AssignTaskModalComponent implements OnInit {
  protected readonly taskState = inject(TaskStateService);
  private readonly api = inject(TaskApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly userEmails = signal<string[]>([]);
  protected readonly usersLoading = signal(true);
  protected readonly usersLoadFailed = signal(false);
  /** Server or network message when the user list fails to load. */
  protected readonly usersLoadError = signal<string>('');

  protected readonly form = this.fb.nonNullable.group({
    assigneeEmail: [''],
  });

  ngOnInit(): void {
    const task = this.taskState.taskForAssign();

    this.api.getAssignableUserEmails().subscribe({
      next: (emails) => {
        this.userEmails.set(emails);
        this.usersLoading.set(false);
        const current = task?.assignee_email?.trim();
        if (current && emails.includes(current)) {
          this.form.patchValue({ assigneeEmail: current });
        }
      },
      error: (err: unknown) => {
        this.usersLoading.set(false);
        this.usersLoadFailed.set(true);
        if (err instanceof HttpErrorResponse) {
          if (err.status === 0) {
            this.usersLoadError.set(
              'Cannot reach the API (connection failed). In a second terminal run: npx nx serve api — then reload this page.'
            );
            return;
          }
          const body = err.error;
          const apiMsg =
            typeof body === 'object' && body !== null && 'error' in body
              ? String((body as { error: string }).error)
              : err.message;
          this.usersLoadError.set(apiMsg);
          return;
        }
        this.usersLoadError.set('Could not load users.');
      },
    });
  }

  protected canSubmit(): boolean {
    return this.form.controls.assigneeEmail.value.trim() !== '';
  }

  protected applyAssign(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    const email = this.form.controls.assigneeEmail.value.trim();
    this.taskState.setTaskAssignee(email);
  }

  protected clearAssignee(): void {
    this.taskState.setTaskAssignee(null);
  }
}
