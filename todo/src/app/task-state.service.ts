import { computed, inject, Injectable, signal } from '@angular/core';
import { Task, TaskStatus } from './task.model';
import { TaskApiService } from './task-api.service';
import { hasTaskDescription } from './task-description.util';

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  archivedTasks: Task[];
  archiveLoading: boolean;
  formMode: 'add' | 'edit';
  formTitle: string;
  formDescription: string;
  formStatus: TaskStatus;
  /** Fibonacci points 1–8, or null if not set. */
  formEstimate: number | null;
  editingTaskId: number | null;
  formResetCounter: number;
  showFormModal: boolean;
  showArchive: boolean;
  showAssignModal: boolean;
  taskForAssign: Task | null;
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
  formEstimate: null,
  editingTaskId: null,
  formResetCounter: 0,
  showFormModal: false,
  showArchive: false,
  showAssignModal: false,
  taskForAssign: null,
};

export type AssigneeFilter = 'all' | 'unassigned' | string;

@Injectable({ providedIn: 'root' })
export class TaskStateService {
  private readonly api = inject(TaskApiService);

  // State as a signal
  private readonly state = signal(initialState);

  /** Global board filter: all tasks, only unassigned, or a specific assignee email. */
  private readonly assigneeFilterSig = signal<AssigneeFilter>('all');

  // Public selectors
  readonly tasks = computed(() => this.state().tasks);
  readonly isLoading = computed(() => this.state().isLoading);
  readonly archivedTasks = computed(() => this.state().archivedTasks);
  readonly archiveLoading = computed(() => this.state().archiveLoading);
  readonly showFormModal = computed(() => this.state().showFormModal);
  readonly showArchive = computed(() => this.state().showArchive);
  readonly showAssignModal = computed(() => this.state().showAssignModal);
  readonly taskForAssign = computed(() => this.state().taskForAssign);

  readonly assigneeFilter = this.assigneeFilterSig.asReadonly();

  /** Distinct assignee emails on the board (for filter dropdown), sorted. */
  readonly assigneeFilterOptions = computed(() => {
    const emails = new Set<string>();
    for (const t of this.state().tasks) {
      const e = t.assignee_email?.trim();
      if (e) emails.add(e);
    }
    const current = this.assigneeFilterSig();
    if (typeof current === 'string' && current !== 'all' && current !== 'unassigned') {
      emails.add(current);
    }
    return [...emails].sort((a, b) => a.localeCompare(b));
  });

  /** Tasks visible on the board after applying the assignee filter. */
  private readonly visibleTasks = computed(() => {
    const tasks = this.state().tasks;
    const f = this.assigneeFilterSig();
    if (f === 'all') return tasks;
    if (f === 'unassigned') return tasks.filter((t) => !t.assignee_email?.trim());
    return tasks.filter((t) => t.assignee_email?.trim() === f);
  });

  // Form state selectors
  readonly formMode = computed(() => this.state().formMode);
  readonly formTitle = computed(() => this.state().formTitle);
  readonly formDescription = computed(() => this.state().formDescription);
  readonly formStatus = computed(() => this.state().formStatus);
  readonly formEstimate = computed(() => this.state().formEstimate);
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
    this.visibleTasks().filter((t) => t.status === TaskStatus.Todo)
  );
  readonly tasksWorkingOnIt = computed(() =>
    this.visibleTasks().filter((t) => t.status === TaskStatus.Doing)
  );
  readonly tasksDone = computed(() =>
    this.visibleTasks().filter((t) => t.status === TaskStatus.Done)
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

  setAssigneeFilterFromSelect(raw: string): void {
    this.assigneeFilterSig.set(raw as AssigneeFilter);
  }

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
      formEstimate: null,
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
      formEstimate: null,
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
      formEstimate: task.estimate ?? null,
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
      formEstimate: null,
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

  setEstimate(estimate: number | null): void {
    this.state.update((s) => ({ ...s, formEstimate: estimate }));
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

    this.api
      .createTask({
        title: s.formTitle,
        description: s.formDescription,
        status: s.formStatus,
        ...(s.formEstimate != null ? { estimate: s.formEstimate } : {}),
      })
      .subscribe({
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
      estimate: s.formEstimate,
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

  openAssignTask(task: Task): void {
    this.state.update((s) => ({ ...s, showAssignModal: true, taskForAssign: task }));
  }

  closeAssignModal(): void {
    this.state.update((s) => ({ ...s, showAssignModal: false, taskForAssign: null }));
  }

  setTaskAssignee(email: string | null): void {
    const task = this.state().taskForAssign;
    if (!task) return;

    this.api.updateTask(task.id, { assignee_email: email }).subscribe({
      next: (updated) => {
        this.state.update((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === updated.id ? updated : t)),
          showAssignModal: false,
          taskForAssign: null,
        }));
      },
    });
  }
}
