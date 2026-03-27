import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SafeHtmlPipe } from './safe-html.pipe';
import { Task, TaskStatus } from './task.model';

@Component({
  selector: 'app-board',
  imports: [SafeHtmlPipe],
  templateUrl: './board.component.html',
})
export class BoardComponent {
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
