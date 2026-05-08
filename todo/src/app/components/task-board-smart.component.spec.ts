import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskBoardSmartComponent } from './task-board-smart.component';
import { TaskStateService } from '../services/task-state.service';
import { TaskApiService } from '../services/task-api.service';
import { Task, TaskStatus } from '../models/task.model';

const taskApiStub = vi.hoisted(() => ({
  getTasks: vi.fn(() => of([])),
  getAssignableUsers: vi.fn(() => of([])),
  getArchivedTasks: vi.fn(() => of([])),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  archiveTask: vi.fn(),
  restoreTask: vi.fn(),
}));

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return {
    id,
    project_id: 1,
    title: `t${id}`,
    description: '',
    status: TaskStatus.Todo,
    ...overrides,
  };
}

describe('TaskBoardSmartComponent', () => {
  beforeEach(() => {
    taskApiStub.getTasks.mockImplementation(() =>
      of([makeTask(1, { assignee_email: 'a@x.co' })]),
    );
    taskApiStub.getAssignableUsers.mockImplementation(() =>
      of([{ email: 'a@x.co', nickname: 'Amy' }]),
    );
    TestBed.configureTestingModule({
      imports: [TaskBoardSmartComponent],
      providers: [
        TaskStateService,
        { provide: TaskApiService, useValue: taskApiStub },
      ],
    });
    const ts = TestBed.inject(TaskStateService);
    ts.setActiveProject(1, 'P');
    ts.loadTasks();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('passes assigneeLabel from task state', () => {
    const fixture = TestBed.createComponent(TaskBoardSmartComponent);
    fixture.detectChanges();
    const fn = fixture.componentInstance['assigneeLabelFn'] as (
      e: string | null | undefined,
    ) => string;
    expect(fn('a@x.co')).toBe('Amy');
    expect(fn('other@x.co')).toBe('other@x.co');
  });
});
