import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Task, TaskStatus } from '../models/task.model';
import type { AssignableUser } from './task-api.service';
import { TaskApiService } from './task-api.service';
import { TaskStateService } from './task-state.service';

const users: AssignableUser[] = [{ email: 'a@x.co', nickname: 'Amy' }];

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return {
    id,
    project_id: 1,
    title: `t${id}`,
    description: '<p>d</p>',
    status: TaskStatus.Todo,
    ...overrides,
  };
}

const apiStub = vi.hoisted(() => ({
  getAssignableUsers: vi.fn(() => of<AssignableUser[]>(users)),
  getTasks: vi.fn(() => of<Task[]>([makeTask(1)])),
  createTask: vi.fn((dto: Record<string, unknown>) =>
    of(
      makeTask(99, {
        title: dto['title'] as string,
        description: dto['description'] as string,
        status: (dto['status'] as TaskStatus) ?? TaskStatus.Todo,
      }),
    ),
  ),
  updateTask: vi.fn((_id: number, u: Record<string, unknown>) =>
    of(
      makeTask(1, {
        title: (u.title as string) ?? 't1',
        description: (u.description as string) ?? '<p>d</p>',
        status: (u.status as TaskStatus) ?? TaskStatus.Todo,
        assignee_email: u.assignee_email as string | null | undefined,
      }),
    ),
  ),
  deleteTask: vi.fn(() => of(void 0)),
  archiveTask: vi.fn(() => of(void 0)),
  getArchivedTasks: vi.fn(() => of<Task[]>([])),
  restoreTask: vi.fn(() => of(makeTask(2))),
}));

describe('TaskStateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiStub.getAssignableUsers.mockImplementation(() => of(users));
    apiStub.getTasks.mockImplementation(() => of([makeTask(1)]));
    apiStub.restoreTask.mockImplementation(() => of(makeTask(2)));

    TestBed.configureTestingModule({
      providers: [
        TaskStateService,
        { provide: TaskApiService, useValue: apiStub },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('setAssigneeFilterFromSelect narrows lists', () => {
    const s = TestBed.inject(TaskStateService);
    s.setActiveProject(1, 'P');
    apiStub.getTasks.mockReturnValueOnce(
      of([
        makeTask(1, { assignee_email: 'a@x.co' }),
        makeTask(3, { assignee_email: 'b@y.co' }),
      ]),
    );
    s.loadTasks();
    s.setAssigneeFilterFromSelect('b@y.co');
    expect(
      s.tasksToBeDone().every((t) => t.assignee_email?.trim() === 'b@y.co'),
    ).toBe(true);
  });

  it('refreshAssignableUsers sets error body on HttpErrorResponse', async () => {
    const s = TestBed.inject(TaskStateService);
    apiStub.getAssignableUsers.mockReturnValueOnce(
      throwError(
        () => new HttpErrorResponse({ status: 401, error: { error: 'nope' } }),
      ),
    );
    await firstValueFrom(s.refreshAssignableUsers());
    expect(s.assignableUsersLoadError()).toBe('nope');
  });

  it('refreshAssignableUsers handles status 0', async () => {
    const s = TestBed.inject(TaskStateService);
    apiStub.getAssignableUsers.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );
    await firstValueFrom(s.refreshAssignableUsers());
    expect(s.assignableUsersLoadError()).toContain('Cannot reach');
  });

  it('refreshAssignableUsers non-http error falls back', async () => {
    const s = TestBed.inject(TaskStateService);
    apiStub.getAssignableUsers.mockReturnValueOnce(throwError(() => 'bad'));
    await firstValueFrom(s.refreshAssignableUsers());
    expect(s.assignableUsersLoadError()).toBe('Could not load users.');
  });

  it('assigneeLabel prefers nickname then email', () => {
    const s = TestBed.inject(TaskStateService);
    s.setActiveProject(1, 'P');
    apiStub.getTasks.mockReturnValueOnce(of([]));
    s.refreshAssignableUsers().subscribe(() => undefined);
    expect(s.assigneeLabel('unknown@co')).toBe('unknown@co');
    expect(s.assigneeLabel('a@x.co')).toBe('Amy');
  });

  it('assigneeOptionLabel formats nickname and email', () => {
    const s = TestBed.inject(TaskStateService);
    expect(s.assigneeOptionLabel({ email: 'e@co', nickname: '  Eva  ' })).toBe(
      'Eva (e@co)',
    );
    expect(s.assigneeOptionLabel({ email: 'e@co', nickname: null })).toBe(
      'e@co',
    );
  });

  it('submitForm validates and creates task when adding', () => {
    const s = TestBed.inject(TaskStateService);
    s.setActiveProject(1, 'Proj');
    s.openAddForm();
    s.setTitle('x');
    s.setDescription('<p>ok</p>');
    s.submitForm();
    expect(apiStub.createTask).toHaveBeenCalled();
  });

  it('closes archive clears list', () => {
    apiStub.getArchivedTasks.mockReturnValue(of([makeTask(9)]));
    const s = TestBed.inject(TaskStateService);
    s.setActiveProject(1, 'P');
    s.openArchive();
    s.closeArchive();
    expect(s.showArchive()).toBe(false);
    expect(s.archivedTasks().length).toBe(0);
  });

  it('disableDoingInForm clears when editing the doing card', () => {
    apiStub.getTasks.mockReturnValue(
      of([makeTask(1, { status: TaskStatus.Doing })]),
    );
    const s = TestBed.inject(TaskStateService);
    s.setActiveProject(1, 'P');
    s.loadTasks();
    apiStub.updateTask.mockReturnValueOnce(
      of(
        makeTask(1, {
          title: 'e',
          description: '<p>e</p>',
          status: TaskStatus.Done,
        }),
      ),
    );
    s.startEdit(
      makeTask(1, {
        title: 'd',
        description: '<p>e</p>',
        status: TaskStatus.Doing,
      }),
    );
    expect(s.disableDoingInForm()).toBe(false);
  });

  it('opens archive loads archived list', () => {
    apiStub.getArchivedTasks.mockReturnValueOnce(of([makeTask(88)]));
    const s = TestBed.inject(TaskStateService);
    s.setActiveProject(1, 'P');
    s.openArchive();
    expect(s.showArchive()).toBe(true);
    expect(s.archivedTasks().some((x) => x.id === 88)).toBe(true);
  });

  it('restoreTask merges archived back', () => {
    apiStub.getArchivedTasks.mockReturnValueOnce(of([makeTask(2)]));
    apiStub.restoreTask.mockReturnValueOnce(of(makeTask(2)));
    const s = TestBed.inject(TaskStateService);
    s.setActiveProject(1, 'P');
    s.openArchive();
    s.restoreTask(2);
    expect(apiStub.restoreTask).toHaveBeenCalledWith(2);
  });

  it('assign modal updates task through API', () => {
    const s = TestBed.inject(TaskStateService);
    s.setActiveProject(1, 'P');
    apiStub.getTasks.mockReturnValueOnce(of([makeTask(5)]));
    s.loadTasks();
    s.openAssignTask(makeTask(5));
    s.setTaskAssignee('z@co');
    expect(apiStub.updateTask).toHaveBeenCalled();
  });

  it('clearProjectContext resets counters', () => {
    const s = TestBed.inject(TaskStateService);
    s.setActiveProject(9, 'N');
    s.clearProjectContext();
    expect(s.activeProjectId()).toBeNull();
  });

  it('applyRemoteTaskUpdate and addTaskLocally merge state', () => {
    const s = TestBed.inject(TaskStateService);
    s.setActiveProject(1, 'P');
    apiStub.getTasks.mockReturnValue(of([makeTask(1)]));
    s.loadTasks();
    s.addTaskLocally(makeTask(7));
    s.applyRemoteTaskUpdate(makeTask(1, { title: 'z' }));
    expect(s.tasks().find((t) => t.id === 1)?.title).toBe('z');
    expect(s.tasks().some((t) => t.id === 7)).toBe(true);
  });
});
