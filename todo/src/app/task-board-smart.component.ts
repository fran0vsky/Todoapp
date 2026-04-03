import { Component, inject } from '@angular/core';
import { TaskBoardPresentationalComponent } from './task-board-presentational.component';
import { TaskStateService } from './task-state.service';

@Component({
  selector: 'app-task-board-smart',
  standalone: true,
  imports: [TaskBoardPresentationalComponent],
  templateUrl: './task-board-smart.component.html',
  host: {
    class: 'flex min-h-0 flex-1 flex-col',
  },
})
export class TaskBoardSmartComponent {
  protected readonly taskState = inject(TaskStateService);
}