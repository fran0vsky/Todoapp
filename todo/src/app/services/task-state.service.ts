import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { Task, TaskStatus } from '../models/task.model';
import { AssignableUser, TaskApiService } from './task-api.service';
import { hasTaskDescription } from '../shared/task-description.util';

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  archivedTasks: Task[];
  archiveLoading: boolean;
  /** Active board scope (set when viewing a project). */
  activeProjectId: number | null;
  activeProjectName: string;
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
  activeProjectId: null,
  activeProjectName: '',
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

  /** From GET /api/users (nicknames for assignee display). */
  private readonly assignableUsersSig = signal<AssignableUser[]>([]);
  private readonly assignableUsersLoadingSig = signal(false);
  private readonly assignableUsersLoadErrorSig = signal<string | null>(null);

  readonly assignableUsers = this.assignableUsersSig.asReadonly();
  readonly assignableUsersLoading = this.assignableUsersLoadingSig.asReadonly();
  readonly assignableUsersLoadError = this.assignableUsersLoadErrorSig.asReadonly();

  // Public selectors
  readonly tasks = computed(() => this.state().tasks);
  readonly isLoading = computed(() => this.state().isLoading);
  readonly archivedTasks = computed(() => this.state().archivedTasks);
  readonly archiveLoading = computed(() => this.state().archiveLoading);
  readonly showFormModal = computed(() => this.state().showFormModal);
  readonly showArchive = computed(() => this.state().showArchive);
  readonly showAssignModal = computed(() => this.state().showAssignModal);
  readonly taskForAssign = computed(() => this.state().taskForAssign);

  readonly activeProjectId = computed(() => this.state().activeProjectId);
  readonly activeProjectName = computed(() => this.state().activeProjectName);

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

  /** Call when entering a project board (from route). Clears lists and sets scope. */
  setActiveProject(projectId: number, projectName: string): void {
    this.assigneeFilterSig.set('all');
    this.assignableUsersSig.set([]);
    this.assignableUsersLoadErrorSig.set(null);
    this.state.update((s) => ({
      ...s,
      activeProjectId: projectId,
      activeProjectName: projectName,
      tasks: [],
      archivedTasks: [],
      showFormModal: false,
      showAssignModal: false,
      showArchive: false,
    }));
  }

  /** Append a task that was created externally (e.g. via voice) to the local board. */
  addTaskLocally(task: Task): void {
    this.state.update((s) => ({ ...s, tasks: [...s.tasks, task] }));
  }

  /** Call when leaving the board (e.g. navigate to project list). */
  clearProjectContext(): void {
    this.assigneeFilterSig.set('all');
    this.assignableUsersSig.set([]);
    this.assignableUsersLoadErrorSig.set(null);
    this.state.set(initialState);
  }

  /** Loads registered users for nickname display and the assign modal. Safe to call repeatedly. */
  refreshAssignableUsers(): Observable<AssignableUser[]> {
    this.assignableUsersLoadingSig.set(true);
    this.assignableUsersLoadErrorSig.set(null);
    return this.api.getAssignableUsers().pipe(
      tap((users) => this.assignableUsersSig.set(users)),
      finalize(() => this.assignableUsersLoadingSig.set(false)),
      catchError((err: unknown) => {
        this.assignableUsersLoadErrorSig.set(this.usersListErrorMessage(err));
        return of([]);
      })
    );
  }

  /** Short label for the card/filter: nickname if set, else email. */
  assigneeLabel(email: string | null | undefined): string {
    const e = email?.trim();
    if (!e) return '';
    const u = this.assignableUsersSig().find((x) => x.email === e);
    const n = u?.nickname?.trim();
    if (n) return n;
    return e;
  }

  /** Assign modal: nickname + email when nickname exists. */
  assigneeOptionLabel(user: AssignableUser): string {
    const n = user.nickname?.trim();
    if (n) return `${n} (${user.email})`;
    return user.email;
  }

  private usersListErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        return 'Cannot reach the API (connection failed). In a second terminal run: npx nx serve api — then reload this page.';
      }
      const body = err.error;
      if (typeof body === 'object' && body !== null && 'error' in body) {
        return String((body as { error: string }).error);
      }
      return err.message;
    }
    return 'Could not load users.';
  }

  loadTasks(): void {
    const pid = this.state().activeProjectId;
    if (pid == null) return;
    this.state.update((s) => ({ ...s, isLoading: true }));
    this.api.getTasks(pid).subscribe({
      next: (tasks) => {
        this.state.update((s) => ({ ...s, tasks, isLoading: false }));
        this.refreshAssignableUsers().subscribe();
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
    if (s.activeProjectId == null) return;

    this.api
      .createTask({
        project_id: s.activeProjectId,
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
    const pid = this.state().activeProjectId;
    if (pid == null) return;
    this.refreshAssignableUsers().subscribe();
    this.state.update((s) => ({ ...s, showArchive: true, archiveLoading: true }));
    this.api.getArchivedTasks(pid).subscribe({
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
