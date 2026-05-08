import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssignTaskModalComponent } from './assign-task-modal.component';
import { TaskStateService } from '../services/task-state.service';
import { TaskApiService } from '../services/task-api.service';
import { TaskStatus } from '../models/task.model';

const taskApiStub = vi.hoisted(() => ({
  getTasks: vi.fn(() => of([])),
  getAssignableUsers: vi.fn(() =>
    of([
      { email: 'u1@test.com', nickname: 'One' },
      { email: 'u2@test.com', nickname: null },
    ]),
  ),
  getArchivedTasks: vi.fn(() => of([])),
  createTask: vi.fn(),
  updateTask: vi.fn((_id: number, u: { assignee_email: string | null }) =>
    of({
      id: 1,
      project_id: 1,
      title: 'T',
      description: '',
      status: TaskStatus.Todo,
      assignee_email: u.assignee_email,
    } as Task),
  ),
  deleteTask: vi.fn(),
  archiveTask: vi.fn(),
  restoreTask: vi.fn(),
}));

describe('AssignTaskModalComponent', () => {
  beforeEach(() => {
    taskApiStub.getTasks.mockImplementation(() =>
      of([
        {
          id: 1,
          project_id: 1,
          title: 'Task title',
          description: '',
          status: TaskStatus.Todo,
        },
      ]),
    );
    taskApiStub.getAssignableUsers.mockImplementation(() =>
      of([
        { email: 'u1@test.com', nickname: 'One' },
        { email: 'u2@test.com', nickname: null },
      ]),
    );
    TestBed.configureTestingModule({
      imports: [AssignTaskModalComponent],
      providers: [
        TaskStateService,
        { provide: TaskApiService, useValue: taskApiStub },
      ],
    });
    const ts = TestBed.inject(TaskStateService);
    ts.setActiveProject(1, 'P');
    ts.loadTasks();
    ts.openAssignTask({
      id: 1,
      project_id: 1,
      title: 'Task title',
      description: '',
      status: TaskStatus.Todo,
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('submits assignee and closes modal on success', () => {
    const fixture = TestBed.createComponent(AssignTaskModalComponent);
    const ts = TestBed.inject(TaskStateService);
    fixture.detectChanges();

    const cmp = fixture.componentInstance as unknown as {
      form: { patchValue: (v: { assigneeEmail: string }) => void };
      applyAssign(): void;
    };
    cmp.form.patchValue({ assigneeEmail: 'u1@test.com' });
    fixture.detectChanges();
    cmp.applyAssign();

    expect(ts.showAssignModal()).toBe(false);
    const task = ts.tasks().find((t) => t.id === 1);
    expect(task?.assignee_email).toBe('u1@test.com');
  });
});
