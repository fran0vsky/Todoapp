import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  provideRouter,
  Router,
  convertToParamMap,
} from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeComponent } from './home.component';
import { ProjectApiService } from '../services/project-api.service';
import { TaskStateService } from '../services/task-state.service';
import { TaskApiService } from '../services/task-api.service';
import { AuthService } from '../services/auth.service';

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

describe('HomeComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskApiStub.getTasks.mockImplementation(() => of([]));
    taskApiStub.getAssignableUsers.mockImplementation(() => of([]));
    taskApiStub.getArchivedTasks.mockImplementation(() => of([]));

    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        TaskStateService,
        { provide: TaskApiService, useValue: taskApiStub },
        {
          provide: ProjectApiService,
          useValue: {
            getProject: vi.fn(() => of({ id: 1, name: 'Alpha' })),
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => null,
            displayLabel: () => '',
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ projectId: '1' })),
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads project and shows active project name', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Alpha');
    const taskState = TestBed.inject(TaskStateService);
    expect(taskState.activeProjectId()).toBe(1);
  });

  it('navigates home when project id is invalid', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        TaskStateService,
        { provide: TaskApiService, useValue: taskApiStub },
        {
          provide: ProjectApiService,
          useValue: { getProject: vi.fn() },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => null,
            displayLabel: () => '',
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ projectId: 'abc' })),
          },
        },
      ],
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('navigates home when getProject fails', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        provideRouter([]),
        TaskStateService,
        { provide: TaskApiService, useValue: taskApiStub },
        {
          provide: ProjectApiService,
          useValue: {
            getProject: vi.fn(() => throwError(() => new Error('404'))),
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => null,
            displayLabel: () => '',
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ projectId: '1' })),
          },
        },
      ],
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('clearProjectContext runs on destroy', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const taskState = TestBed.inject(TaskStateService);
    expect(taskState.activeProjectId()).toBe(1);
    fixture.destroy();
    expect(taskState.activeProjectId()).toBeNull();
  });
});
