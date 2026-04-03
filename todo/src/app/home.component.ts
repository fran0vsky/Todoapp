import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TaskFormModalComponent } from './task-form-modal.component';
import { TaskBoardSmartComponent } from './task-board-smart.component';
import { TaskStateService } from './task-state.service';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, TaskBoardSmartComponent, TaskFormModalComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  protected readonly taskState = inject(TaskStateService);
  protected readonly authService = inject(AuthService);

  ngOnInit(): void {
    this.taskState.loadTasks();
  }

  protected logout(): void {
    this.authService.signOutAndRedirect();
  }
}
