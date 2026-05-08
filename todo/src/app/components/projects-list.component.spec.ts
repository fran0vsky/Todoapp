import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsListComponent } from './projects-list.component';
import { ProjectApiService } from '../services/project-api.service';
import { AuthService } from '../services/auth.service';
import { TaskStateService } from '../services/task-state.service';
import { TaskApiService } from '../services/task-api.service';

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

describe('ProjectsListComponent', () => {
  const getProjects = vi.fn();
  const createProject = vi.fn();
  const deleteProject = vi.fn();

  beforeEach(() => {
    getProjects.mockReset();
    createProject.mockReset();
    deleteProject.mockReset();
    getProjects.mockReturnValue(of([{ id: 1, name: 'P1' }]));
    createProject.mockReturnValue(of({ id: 2, name: 'New' }));
    deleteProject.mockReturnValue(of(void 0));
    taskApiStub.getTasks.mockImplementation(() => of([]));
    taskApiStub.getAssignableUsers.mockImplementation(() => of([]));

    TestBed.configureTestingModule({
      imports: [ProjectsListComponent],
      providers: [
        provideRouter([]),
        TaskStateService,
        { provide: TaskApiService, useValue: taskApiStub },
        {
          provide: ProjectApiService,
          useValue: { getProjects, createProject, deleteProject },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => null,
            isAdmin: () => false,
            displayLabel: () => '',
          },
        },
      ],
    });
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('lists projects after load', () => {
    const fixture = TestBed.createComponent(ProjectsListComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('P1');
  });

  it('createProject navigates to new board', () => {
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate');
    const fixture = TestBed.createComponent(ProjectsListComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      '#new-project-name',
    ) as HTMLInputElement;
    input.value = 'My Board';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const createBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Create')) as HTMLButtonElement;
    createBtn.click();
    expect(createProject).toHaveBeenCalledWith({ name: 'My Board' });
    expect(navSpy).toHaveBeenCalledWith(['/p', 2]);
  });

  it('admin can delete project when confirm returns true', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProjectsListComponent],
      providers: [
        provideRouter([]),
        TaskStateService,
        { provide: TaskApiService, useValue: taskApiStub },
        {
          provide: ProjectApiService,
          useValue: { getProjects, createProject, deleteProject },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => null,
            isAdmin: () => true,
            displayLabel: () => '',
          },
        },
      ],
    });
    getProjects.mockReturnValue(of([{ id: 7, name: 'DelMe' }]));
    const fixture = TestBed.createComponent(ProjectsListComponent);
    fixture.detectChanges();
    const delBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Delete project"]',
    );
    expect(delBtn).toBeInstanceOf(HTMLButtonElement);
    (delBtn as HTMLButtonElement).click();
    expect(deleteProject).toHaveBeenCalledWith(7);
  });
});
