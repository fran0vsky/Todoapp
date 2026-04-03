import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AddEditTaskComponent } from './add-edit-task.component';
import { BoardComponent } from './board.component';
import { Task, TaskStatus } from './task.model';
import { TaskApiService } from './task-api.service';
import { hasTaskDescription } from './task-description.util';

type FormMode = 'add' | 'edit';

@Component({
  imports: [BoardComponent, AddEditTaskComponent],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly api = inject(TaskApiService);

  protected readonly TaskStatus = TaskStatus;
  protected readonly hasTaskDescription = hasTaskDescription;

  protected tasks = signal<Task[]>([]);
  protected isLoading = signal(false);

  // Unified add/edit modal
  protected showFormModal = signal(false);
  protected formMode = signal<FormMode>('add');
  protected formTitle = signal('');
  protected formDescription = signal('');
  protected formStatus = signal<TaskStatus>(TaskStatus.Todo);
  private editingTaskId = signal<number | null>(null);

  /** Bumped on Clear / close so the form child re-syncs even when values are unchanged (e.g. edit + Clear). */
  protected formResetCounter = signal(0);

  // Archive
  protected showArchive = signal(false);
  protected archivedTasks = signal<Task[]>([]);
  protected archiveLoading = signal(false);

  /** At most one task may be in "Work in progress" at a time. */
  protected workInProgressFull = computed(
    () =>
      this.tasks().filter((t) => t.status === TaskStatus.Doing).length >= 1
  );

  protected formModalTitle = computed(() =>
    this.formMode() === 'add' ? 'Add task' : 'Edit task'
  );

  ngOnInit(): void {
    this.loadTasks();
  }

  private loadTasks(): void {
    this.isLoading.set(true);
    this.api.getTasks().subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  // ---------- Add / Edit Modal ----------

  protected openAddForm(): void {
    this.formStatus.set(TaskStatus.Todo);
    this.formMode.set('add');
    this.formTitle.set('');
    this.formDescription.set('');
    this.editingTaskId.set(null);
    this.showFormModal.set(true);
    this.formResetCounter.update((n) => n + 1);
  }

  protected openAddFormWithStatus(status: TaskStatus): void {
    if (status === TaskStatus.Doing && this.workInProgressFull()) {
      return;
    }
    this.formStatus.set(status);
    this.formMode.set('add');
    this.formTitle.set('');
    this.formDescription.set('');
    this.editingTaskId.set(null);
    this.showFormModal.set(true);
    this.formResetCounter.update((n) => n + 1);
  }

  protected startEdit(task: Task): void {
    this.formMode.set('edit');
    this.formTitle.set(task.title);
    this.formDescription.set(task.description);
    this.formStatus.set(task.status);
    this.editingTaskId.set(task.id);
    this.showFormModal.set(true);
    this.formResetCounter.update((n) => n + 1);
  }

  protected closeFormModal(): void {
    this.showFormModal.set(false);
    this.resetFormFields();
  }

  /** Clears the form (add and edit): empty title/description, status To be done. */
  protected resetFormFields(): void {
    this.formTitle.set('');
    this.formDescription.set('');
    this.formStatus.set(TaskStatus.Todo);
    this.formResetCounter.update((n) => n + 1);
  }

  protected submitForm(): void {
    if (this.formMode() === 'add') {
      this.addTask();
    } else {
      this.saveEdit();
    }
  }

  private addTask(): void {
    const title = this.formTitle().trim();
    if (!title) return;
    if (!hasTaskDescription(this.formDescription())) return;

    const status = this.formStatus();
    if (status === TaskStatus.Doing && this.workInProgressFull()) {
      return;
    }

    const description = this.formDescription().trim();
    this.api.createTask({ title, description, status }).subscribe({
      next: (created) => {
        this.tasks.update((current) => [...current, created]);
        this.closeFormModal();
      },
    });
  }

  private saveEdit(): void {
    const id = this.editingTaskId();
    if (id == null) return;
    if (!hasTaskDescription(this.formDescription())) return;

    const title = this.formTitle().trim();
    const description = this.formDescription().trim();
    const status = this.formStatus();

    this.api
      .updateTask(id, {
        ...(title ? { title } : {}),
        description,
        status,
      })
      .subscribe({
        next: (updated) => {
          this.tasks.update((current) =>
            current.map((t) => (t.id === updated.id ? updated : t))
          );
          this.closeFormModal();
        },
      });
  }

  // ---------- Remove / Archive ----------

  protected removeTask(id: number): void {
    this.api.deleteTask(id).subscribe({
      next: () => {
        this.tasks.update((current) => current.filter((t) => t.id !== id));
      },
    });
  }

  protected archiveTask(id: number): void {
    this.api.archiveTask(id).subscribe({
      next: () => {
        this.tasks.update((current) => current.filter((t) => t.id !== id));
      },
    });
  }

  protected openArchive(): void {
    this.showArchive.set(true);
    this.archiveLoading.set(true);
    this.api.getArchivedTasks().subscribe({
      next: (tasks) => {
        this.archivedTasks.set(tasks);
        this.archiveLoading.set(false);
      },
      error: () => {
        this.archiveLoading.set(false);
      },
    });
  }

  protected closeArchive(): void {
    this.showArchive.set(false);
    this.archivedTasks.set([]);
  }

  protected restoreTask(id: number): void {
    this.api.restoreTask(id).subscribe({
      next: (restored) => {
        this.archivedTasks.update((current) =>
          current.filter((t) => t.id !== id)
        );
        this.tasks.update((current) => [...current, restored]);
      },
    });
  }

  // ---------- Computed columns ----------

  protected tasksToBeDone = computed(() =>
    this.tasks().filter((t) => t.status === TaskStatus.Todo)
  );

  protected tasksWorkingOnIt = computed(() =>
    this.tasks().filter((t) => t.status === TaskStatus.Doing)
  );

  protected tasksDone = computed(() =>
    this.tasks().filter((t) => t.status === TaskStatus.Done)
  );

  // ---------- Validation ----------

  protected formSubmitDisabled = computed(() => {
    if (!this.formTitle().trim()) return true;
    if (!hasTaskDescription(this.formDescription())) return true;
    if (
      this.formMode() === 'add' &&
      this.formStatus() === TaskStatus.Doing &&
      this.workInProgressFull()
    ) {
      return true;
    }
    if (
      this.formMode() === 'edit' &&
      this.formStatus() === TaskStatus.Doing &&
      this.workInProgressFull()
    ) {
      const editId = this.editingTaskId();
      const currentTask = this.tasks().find((t) => t.id === editId);
      if (currentTask?.status !== TaskStatus.Doing) {
        return true;
      }
    }
    return false;
  });

  protected formSaveDisabledHint(): string {
    if (!this.formTitle().trim()) {
      return 'Enter a title first.';
    }
    if (!hasTaskDescription(this.formDescription())) {
      return 'Description is required — fill in the description field before saving.';
    }
    if (this.formStatus() === TaskStatus.Doing && this.workInProgressFull()) {
      return 'Work in progress is full. Only one task allowed there.';
    }
    return '';
  }

  /** In edit mode, disable Doing option only if WIP is full AND the task wasn't already Doing. */
  protected disableDoingInForm = computed(() => {
    if (!this.workInProgressFull()) return false;
    if (this.formMode() === 'edit') {
      const editId = this.editingTaskId();
      const task = this.tasks().find((t) => t.id === editId);
      if (task?.status === TaskStatus.Doing) return false;
    }
    return true;
  });
}
