import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type TaskStatus = 'todo' | 'doing' | 'done';

@Component({
  imports: [FormsModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'todo';
  protected showAddForm = false;
  protected newTaskText = '';
  protected newTaskDescription = '';
  protected newTaskStatus: TaskStatus = 'todo';
  protected tasks: {
    id: number;
    title: string;
    description: string;
    status: TaskStatus;
  }[] = [];
  protected isLoading = true;
  protected editingId: number | null = null;
  protected editTitleText = '';
  protected editDescriptionText = '';
  private nextId = 1;

  constructor() {
    this.loadTasks();
  }

  private loadTasks(): void {
    setTimeout(() => {
      this.isLoading = false;
    }, 350);
  }

  protected addTask(): void {
    const title = this.newTaskText.trim();
    if (!title) return;

    this.tasks.push({
      id: this.nextId++,
      title,
      description: this.newTaskDescription.trim(),
      status: this.newTaskStatus,
    });
    this.newTaskText = '';
    this.newTaskDescription = '';
    this.newTaskStatus = 'todo';
    this.showAddForm = false;
  }

  protected closeAddForm(): void {
    this.showAddForm = false;
    this.newTaskText = '';
    this.newTaskDescription = '';
    this.newTaskStatus = 'todo';
  }

  protected removeTask(id: number): void {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.editingId === id) {
      this.editingId = null;
      this.editTitleText = '';
      this.editDescriptionText = '';
    }
  }

  protected startEdit(task: { id: number; title: string; description: string }): void {
    this.editingId = task.id;
    this.editTitleText = task.title;
    this.editDescriptionText = task.description;
  }

  protected saveEdit(): void {
    if (this.editingId == null) return;
    const t = this.tasks.find((x) => x.id === this.editingId);
    if (t) {
      const nextTitle = this.editTitleText.trim();
      if (nextTitle) t.title = nextTitle;
      t.description = this.editDescriptionText.trim();
    }
    this.editingId = null;
    this.editTitleText = '';
    this.editDescriptionText = '';
  }

  protected cancelEdit(): void {
    this.editingId = null;
    this.editTitleText = '';
    this.editDescriptionText = '';
  }

  protected get tasksToBeDone(): {
    id: number;
    title: string;
    description: string;
    status: TaskStatus;
  }[] {
    return this.tasks.filter((t) => t.status === 'todo');
  }

  protected get tasksWorkingOnIt(): {
    id: number;
    title: string;
    description: string;
    status: TaskStatus;
  }[] {
    return this.tasks.filter((t) => t.status === 'doing');
  }

  protected get tasksDone(): {
    id: number;
    title: string;
    description: string;
    status: TaskStatus;
  }[] {
    return this.tasks.filter((t) => t.status === 'done');
  }

  protected openAddForm(): void {
    this.newTaskStatus = 'todo';
    this.showAddForm = true;
  }

  protected openAddFormWithStatus(status: TaskStatus): void {
    this.newTaskStatus = status;
    this.showAddForm = true;
  }
}
