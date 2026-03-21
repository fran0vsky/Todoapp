import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AddEditTaskComponent } from './add-edit-task.component';
import { Task, TaskStatus } from './task.model';

@Component({
  selector: 'app-board',
  imports: [AddEditTaskComponent],
  templateUrl: './board.component.html',
})
export class BoardComponent {
  protected readonly TaskStatus = TaskStatus;

  @Input() isLoading = false;
  @Input() editingId: number | null = null;
  @Input() editTitleText = '';
  @Input() editDescriptionText = '';
  @Input() tasksToBeDone: Task[] = [];
  @Input() tasksWorkingOnIt: Task[] = [];
  @Input() tasksDone: Task[] = [];

  @Output() openAddWithStatus = new EventEmitter<TaskStatus>();
  @Output() startEdit = new EventEmitter<Task>();
  @Output() removeTask = new EventEmitter<number>();
  @Output() saveEdit = new EventEmitter<void>();
  @Output() cancelEdit = new EventEmitter<void>();
  @Output() editTitleTextChange = new EventEmitter<string>();
  @Output() editDescriptionTextChange = new EventEmitter<string>();
}

