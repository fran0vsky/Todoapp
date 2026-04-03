import { Component, inject } from '@angular/core';
import { AddEditTaskComponent } from './add-edit-task.component';
import { TaskStateService } from './task-state.service';

@Component({
  selector: 'app-task-form-modal',
  standalone: true,
  imports: [AddEditTaskComponent],
  templateUrl: './task-form-modal.component.html',
})
export class TaskFormModalComponent {
  protected readonly taskState = inject(TaskStateService);
}