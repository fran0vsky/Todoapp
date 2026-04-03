import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SafeHtmlPipe } from './safe-html.pipe';
import { Task, TaskStatus } from './task.model';

@Component({
  selector: 'app-task-board-presentational',
  standalone: true,
  imports: [SafeHtmlPipe],
  templateUrl: './task-board-presentational.component.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
  },
})
export class TaskBoardPresentationalComponent {
  protected readonly TaskStatus = TaskStatus;

  @Input() isLoading = false;
  @Input() workInProgressFull = false;
  @Input() tasksToBeDone: Task[] = [];
  @Input() tasksWorkingOnIt: Task[] = [];
  @Input() tasksDone: Task[] = [];

  @Output() openAddWithStatus = new EventEmitter<TaskStatus>();
  @Output() startEdit = new EventEmitter<Task>();
  @Output() removeTask = new EventEmitter<number>();
  @Output() archiveTask = new EventEmitter<number>();
}