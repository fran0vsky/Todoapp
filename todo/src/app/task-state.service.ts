import { computed, inject, Injectable, signal } from '@angular/core';
import { Task, TaskStatus } from './task.model';
import { TaskApiService } from './task-api.service';
import { hasTaskDescription } from './task-description.util';
import { Observable, tap } from 'rxjs';

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  archivedTasks: Task[];
  archiveLoading: boolean;
  formMode: 'add' | 'edit';
  formTitle: string;
  formDescription: string;
  formStatus: TaskStatus;
  editingTaskId: number | null;
  formResetCounter: number;
  showFormModal: boolean;
  showArchive: boolean;
}

const initialState: TaskState = {
  tasks: [],
  isLoading: false,
  archivedTasks: [],
  archiveLoading: false,
  formMode: 'add',
  formTitle: '',
  formDescription: '',
  formStatus: TaskStatus.Todo,
  editingTaskId: null,
  formResetCounter: 0,
  showFormModal: false,
  showArchive: false,
};

@Injectable({ providedIn: 'root' })
export class TaskStateService {
  private readonly api = inject(TaskApiService);

  // State as a signal
  private readonly state = signal(initialState);

  // Public selectors
  readonly tasks = computed(() => this.state().tasks);
  readonly isLoading = computed(() => this.state().isLoading);
  readonly archivedTasks = computed(() => this.state().archivedTasks);
  readonly archiveLoading = computed(() => this.state().archiveLoading);
  readonly showFormModal = computed(() => this.state().showFormModal);
  readonly showArchive = computed(() => this.state().showArchive);

  // Form state selectors
  readonly formMode = computed(() => this.state().formMode);
  readonly formTitle = computed(() => this.state().formTitle);
  readonly formDescription = computed(() => this.state().formDescription);
  readonly formStatus = computed(() => this.state().formStatus);
  readonly editingTaskId = computed(() => this.state().editingTaskId);
  readonly formResetCounter = computed(() => this.state().formResetCounter);

  // Derived state
  readonly formModalTitle = computed(() =>
    this.state().formMode === 'add' ? 'Add task' : 'Edit task'
  );

  readonly workInProgressFull = computed(
    () =>
      this.state().tasks.filter((t) => t.status === TaskStatus.Doing).length >=
      1
  );

  readonly tasksToBeDone = computed(() =>
    this.state().tasks.filter((t) => t.status === TaskStatus.Todo)
  );
  readonly tasksWorkingOnIt = computed(() =>
    this.state().tasks.filter((t) => t.status === TaskStatus.Doing)
  );
  readonly tasksDone = computed(() =>
    this.state().tasks.filter((t) => t.status === TaskStatus.Done)
  );

  readonly formSubmitDisabled = computed(() => {
    const s = this.state();
    if (!s.formTitle.trim()) return true;
    if (!hasTaskDescription(s.formDescription)) return true;
    if (s.formMode === 'add' && s.formStatus === TaskStatus.Doing && this.workInProgressFull()) {
      return true;
    }
    if (s.formMode === 'edit' && s.formStatus === TaskStatus.Doing && this.workInProgressFull()) {
      const currentTask = s.tasks.find((t) => t.id === s.editingTaskId);
      if (currentTask?.status !== TaskStatus.Doing) {
        return true;
      }
    }
    return false;
  });

  readonly formSaveDisabledHint = computed(() => {
    const s = this.state();
    if (!s.formTitle.trim()) return 'Enter a title first.';
    if (!hasTaskDescription(s.formDescription)) return 'Description is required — fill in the description field before saving.';
    if (s.formStatus === TaskStatus.Doing && this.workInProgressFull()) {
      return 'Work in progress is full. Only one task allowed there.';
    }
    return '';
  });

  readonly disableDoingInForm = computed(() => {
    const s = this.state();
    if (!this.workInProgressFull()) return false;
    if (s.formMode === 'edit') {
      const task = s.tasks.find((t) => t.id === s.editingTaskId);
      if (task?.status === TaskStatus.Doing) return false;
    }
    return true;
  });

  // Actions

  loadTasks(): void {
    this.state.update((s) => ({ ...s, isLoading: true }));
    this.api.getTasks().subscribe({
      next: (tasks) => {
        this.state.update((s) => ({ ...s, tasks, isLoading: false }));
      },
      error: () => {
        this.state.update((s) => ({ ...s, isLoading: false }));
      },
    });
  }

  openAddForm(): void {
    this.state.update((s) => ({ ...s,
      showFormModal: true,
      formMode: 'add',
      formTitle: '',
      formDescription: '',
      formStatus: TaskStatus.Todo,
      editingTaskId: null,
      formResetCounter: s.formResetCounter + 1,
    }));
  }

  openAddFormWithStatus(status: TaskStatus): void {
    if (status === TaskStatus.Doing && this.workInProgressFull()) return;
    this.state.update((s) => ({ ...s,
      showFormModal: true,
      formMode: 'add',
      formTitle: '',
      formDescription: '',
      formStatus: status,
      editingTaskId: null,
      formResetCounter: s.formResetCounter + 1,
    }));
  }

  startEdit(task: Task): void {
    this.state.update((s) => ({ ...s,
      showFormModal: true,
      formMode: 'edit',
      formTitle: task.title,
      formDescription: task.description,
      formStatus: task.status,
      editingTaskId: task.id,
      formResetCounter: s.formResetCounter + 1,
    }));
  }

  closeFormModal(): void {
    this.state.update((s) => ({ ...s, showFormModal: false }));
    this.resetFormFields();
  }

  resetFormFields(): void {
    this.state.update((s) => ({ ...s,
      formTitle: '',
      formDescription: '',
      formStatus: TaskStatus.Todo,
      formResetCounter: s.formResetCounter + 1,
    }));
  }

  setTitle(title: string): void {
    this.state.update((s) => ({ ...s, formTitle: title }));
  }

  setDescription(description: string): void {
    this.state.update((s) => ({ ...s, formDescription: description }));
  }

  setStatus(status: TaskStatus): void {
    this.state.update((s) => ({ ...s, formStatus: status }));
  }

  submitForm(): void {
    const s = this.state();
    if (this.formSubmitDisabled()) return; // Should be handled by UI, but good to have a guard.

    if (s.formMode === 'add') {
      this.addTask();
    } else {
      this.saveEdit();
    }
  }

  private addTask(): void {
    const s = this.state();
    // Guards should be covered by formSubmitDisabled, but keep for type safety/clarity.
    if (!s.formTitle.trim()) return;
    if (!hasTaskDescription(s.formDescription)) return;
    if (s.formStatus === TaskStatus.Doing && this.workInProgressFull()) return;

    this.api.createTask({ title: s.formTitle, description: s.formDescription, status: s.formStatus }).subscribe({
      next: (created) => {
        this.state.update((state) => ({ ...state, tasks: [...state.tasks, created] }));
        this.closeFormModal();
      },
    });
  }

  private saveEdit(): void {
    const s = this.state();
    if (s.editingTaskId == null) return;
    // Guards should be covered by formSubmitDisabled, but keep for type safety/clarity.
    if (!s.formTitle.trim()) return;
    if (!hasTaskDescription(s.formDescription)) return;

    const updates = {
      ...(s.formTitle.trim() ? { title: s.formTitle.trim() } : {}),
      description: s.formDescription.trim(),
      status: s.formStatus,
    };

    this.api.updateTask(s.editingTaskId, updates).subscribe({
      next: (updated) => {
        this.state.update((state) => ({ ...state,
          tasks: state.tasks.map((t) => (t.id === updated.id ? updated : t)),
        }));
        this.closeFormModal();
      },
    });
  }

  removeTask(id: number): void {
    this.api.deleteTask(id).subscribe({
      next: () => {
        this.state.update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
      },
    });
  }

  archiveTask(id: number): void {
    this.api.archiveTask(id).subscribe({
      next: () => {
        this.state.update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
      },
    });
  }

  openArchive(): void {
    this.state.update((s) => ({ ...s, showArchive: true, archiveLoading: true }));
    this.api.getArchivedTasks().subscribe({
      next: (archivedTasks) => {
        this.state.update((s) => ({ ...s, archivedTasks, archiveLoading: false }));
      },
      error: () => {
        this.state.update((s) => ({ ...s, archiveLoading: false }));
      },
    });
  }

  closeArchive(): void {
    this.state.update((s) => ({ ...s, showArchive: false, archivedTasks: [] }));
  }

  restoreTask(id: number): void {
    this.api.restoreTask(id).subscribe({
      next: (restored) => {
        this.state.update((s) => ({ ...s,
          archivedTasks: s.archivedTasks.filter((t) => t.id !== id),
          tasks: [...s.tasks, restored],
        }));
      },
    });
  }
}
