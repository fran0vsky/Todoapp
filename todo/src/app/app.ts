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
  protected readonly TaskStatus = TaskStatus;
  protected title = 'todo';
  protected showAddForm = signal(false);
  protected newTaskText = signal('');
  protected newTaskDescription = signal('');
  protected newTaskStatus = signal<TaskStatus>(TaskStatus.Todo);
  protected tasks = signal<Task[]>([]);
  protected isLoading = signal(false);
  protected editingId = signal<number | null>(null);
  protected editTitleText = signal('');
  protected editDescriptionText = signal('');
  private readonly editBaseline = signal<{
    title: string;
    description: string;
  } | null>(null);
  private nextId = 1;

  /** At most one task may be in "Work in progress" at a time. */
  protected workInProgressFull = computed(
    () =>
      this.tasks().filter((t) => t.status === TaskStatus.Doing).length >= 1
  );

  protected addTask(): void {
    const title = this.newTaskText().trim();
    if (!title) return;

    const status = this.newTaskStatus();
    if (status === TaskStatus.Doing && this.workInProgressFull()) {
      return;
    }

    this.tasks.update((current) => [
      ...current,
      {
        id: this.nextId++,
        title,
        description: this.newTaskDescription().trim(),
        status,
      },
    ]);
    this.newTaskText.set('');
    this.newTaskDescription.set('');
    this.newTaskStatus.set(TaskStatus.Todo);
    this.showAddForm.set(false);
  }

  protected closeAddForm(): void {
    this.showAddForm.set(false);
    this.newTaskText.set('');
    this.newTaskDescription.set('');
    this.newTaskStatus.set(TaskStatus.Todo);
  }

  /** Reset add form fields without closing the modal. */
  protected resetAddForm(): void {
    this.newTaskText.set('');
    this.newTaskDescription.set('');
    this.newTaskStatus.set(TaskStatus.Todo);
  }

  protected removeTask(id: number): void {
    this.tasks.update((current) => current.filter((t) => t.id !== id));
    if (this.editingId() === id) {
      this.editingId.set(null);
      this.editTitleText.set('');
      this.editDescriptionText.set('');
      this.editBaseline.set(null);
    }
  }

  protected startEdit(task: Task): void {
    this.editingId.set(task.id);
    this.editTitleText.set(task.title);
    this.editDescriptionText.set(task.description);
    this.editBaseline.set({
      title: task.title,
      description: task.description,
    });
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
    this.editBaseline.set(null);
  }

  /** Reset inline edit fields to last saved values (stay in edit mode). */
  protected clearEditFields(): void {
    const b = this.editBaseline();
    if (!b) return;
    this.editTitleText.set(b.title);
    this.editDescriptionText.set(b.description);
  }

  protected tasksToBeDone = computed(() =>
    this.tasks().filter((t) => t.status === TaskStatus.Todo)
  );

  protected tasksWorkingOnIt = computed(() =>
    this.tasks().filter((t) => t.status === TaskStatus.Doing)
  );

  protected tasksDone = computed(() =>
    this.tasks().filter((t) => t.status === TaskStatus.Done)
  );

  protected openAddForm(): void {
    this.newTaskStatus.set(TaskStatus.Todo);
    this.showAddForm.set(true);
  }

  protected openAddFormWithStatus(status: TaskStatus): void {
    if (status === TaskStatus.Doing && this.workInProgressFull()) {
      return;
    }
    this.newTaskStatus.set(status);
    this.showAddForm.set(true);
  }
}
