import { Component, computed, signal } from '@angular/core';
import { AddEditTaskComponent } from './add-edit-task.component';
import { BoardComponent } from './board.component';
import { Task, TaskStatus } from './task.model';

@Component({
  imports: [BoardComponent, AddEditTaskComponent],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected title = 'todo';
  protected showAddForm = signal(false);
  protected newTaskText = signal('');
  protected newTaskDescription = signal('');
  protected newTaskStatus = signal<TaskStatus>('todo');
  protected tasks = signal<Task[]>([]);
  protected isLoading = signal(true);
  protected editingId = signal<number | null>(null);
  protected editTitleText = signal('');
  protected editDescriptionText = signal('');
  private nextId = 1;

  constructor() {
    this.loadTasks();
  }

  private loadTasks(): void {
    setTimeout(() => {
      this.isLoading.set(false);
    }, 350);
  }

  protected addTask(): void {
    const title = this.newTaskText().trim();
    if (!title) return;

    this.tasks.update((current) => [
      ...current,
      {
        id: this.nextId++,
        title,
        description: this.newTaskDescription().trim(),
        status: this.newTaskStatus(),
      },
    ]);
    this.newTaskText.set('');
    this.newTaskDescription.set('');
    this.newTaskStatus.set('todo');
    this.showAddForm.set(false);
  }

  protected closeAddForm(): void {
    this.showAddForm.set(false);
    this.newTaskText.set('');
    this.newTaskDescription.set('');
    this.newTaskStatus.set('todo');
  }

  protected removeTask(id: number): void {
    this.tasks.update((current) => current.filter((t) => t.id !== id));
    if (this.editingId() === id) {
      this.editingId.set(null);
      this.editTitleText.set('');
      this.editDescriptionText.set('');
    }
  }

  protected startEdit(task: Task): void {
    this.editingId.set(task.id);
    this.editTitleText.set(task.title);
    this.editDescriptionText.set(task.description);
  }

  protected saveEdit(): void {
    const currentEditingId = this.editingId();
    if (currentEditingId == null) return;

    this.tasks.update((current) =>
      current.map((task) => {
        if (task.id !== currentEditingId) return task;
        const nextTitle = this.editTitleText().trim();
        return {
          ...task,
          title: nextTitle || task.title,
          description: this.editDescriptionText().trim(),
        };
      })
    );

    this.editingId.set(null);
    this.editTitleText.set('');
    this.editDescriptionText.set('');
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editTitleText.set('');
    this.editDescriptionText.set('');
  }

  protected tasksToBeDone = computed(() =>
    this.tasks().filter((t) => t.status === 'todo')
  );

  protected tasksWorkingOnIt = computed(() =>
    this.tasks().filter((t) => t.status === 'doing')
  );

  protected tasksDone = computed(() =>
    this.tasks().filter((t) => t.status === 'done')
  );

  protected openAddForm(): void {
    this.newTaskStatus.set('todo');
    this.showAddForm.set(true);
  }

  protected openAddFormWithStatus(status: TaskStatus): void {
    this.newTaskStatus.set(status);
    this.showAddForm.set(true);
  }
}
