import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TaskStateService } from './task-state.service';

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
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    assigneeEmail: [''],
  });

  ngOnInit(): void {
    const task = this.taskState.taskForAssign();
    this.taskState.refreshAssignableUsers().subscribe((users) => {
      const current = task?.assignee_email?.trim();
      if (current && users.some((u) => u.email === current)) {
        this.form.patchValue({ assigneeEmail: current });
      }
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
