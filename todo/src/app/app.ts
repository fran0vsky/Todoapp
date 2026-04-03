import { Component, inject, OnInit } from '@angular/core';
import { TaskFormModalComponent } from './task-form-modal.component';
import { TaskBoardSmartComponent } from './task-board-smart.component';
import { TaskStateService } from './task-state.service';
import { TaskStatus } from './task.model';

@Component({
  imports: [TaskBoardSmartComponent, TaskFormModalComponent],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly taskState = inject(TaskStateService);

  ngOnInit(): void {
    this.taskState.loadTasks();
  }
}
