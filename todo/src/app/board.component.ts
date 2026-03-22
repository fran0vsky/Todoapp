import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AddEditTaskComponent } from './add-edit-task.component';
import { SafeHtmlPipe } from './safe-html.pipe';
import { Task, TaskStatus } from './task.model';
import { hasTaskDescription } from './task-description.util';

@Component({
  selector: 'app-board',
  imports: [AddEditTaskComponent, SafeHtmlPipe],
  templateUrl: './board.component.html',
})
export class BoardComponent {
  protected readonly TaskStatus = TaskStatus;
  protected readonly hasTaskDescription = hasTaskDescription;

  @Input() isLoading = false;
  @Input() workInProgressFull = false;
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
  @Output() clearEditFields = new EventEmitter<void>();
  @Output() editTitleTextChange = new EventEmitter<string>();
  @Output() editDescriptionTextChange = new EventEmitter<string>();

  /** Tooltip when inline Save is inactive (hover to see). */
  protected editSaveDisabledHint(title: string, description: string): string {
    if (!title.trim()) {
      return 'Enter a title first.';
    }
    if (!hasTaskDescription(description)) {
      return 'Description is required — fill in the description field before saving.';
    }
    return '';
  }

  /** Short banner headline when inline save is blocked. */
  protected editSaveBlockedTitle(title: string, description: string): string {
    if (!title.trim()) {
      return 'Title required!';
    }
    if (!hasTaskDescription(description)) {
      return 'Description required!';
    }
    return '';
  }
}

