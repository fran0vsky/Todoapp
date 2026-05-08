import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeNavbarComponent } from './home-navbar.component';
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

describe('HomeNavbarComponent', () => {
  const signOutAndRedirect = vi.fn();
  const updateNickname = vi.fn();

  beforeEach(() => {
    signOutAndRedirect.mockReset();
    updateNickname.mockReset();
    taskApiStub.getTasks.mockImplementation(() => of([]));
    taskApiStub.getAssignableUsers.mockImplementation(() => of([]));
    TestBed.configureTestingModule({
      imports: [HomeNavbarComponent],
      providers: [
        provideRouter([]),
        TaskStateService,
        { provide: TaskApiService, useValue: taskApiStub },
        {
          provide: AuthService,
          useValue: {
            currentUser: () =>
              ({
                id: '1',
                email: 'u@test.com',
                app_metadata: {},
                user_metadata: {},
              }) as never,
            displayLabel: () => 'User',
            nicknameFromMetadata: () => '',
            updateNickname: (name: string) => updateNickname(name),
            signOutAndRedirect,
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('calls signOutAndRedirect when Logout is clicked', () => {
    const fixture = TestBed.createComponent(HomeNavbarComponent);
    fixture.detectChanges();
    const logoutBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => b.textContent?.trim() === 'Logout') as HTMLButtonElement;
    logoutBtn.click();
    expect(signOutAndRedirect).toHaveBeenCalled();
  });

  it('saveNickname closes panel and refreshes assignable users on success', () => {
    updateNickname.mockReturnValue(of({}));
    const fixture = TestBed.createComponent(HomeNavbarComponent);
    const taskState = TestBed.inject(TaskStateService);
    const refreshSpy = vi
      .spyOn(taskState, 'refreshAssignableUsers')
      .mockReturnValue(of(undefined));
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector(
      'button[aria-haspopup="dialog"]',
    ) as HTMLButtonElement;
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector(
      '#nickname-input',
    ) as HTMLInputElement;
    input.value = 'Nick';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const saveBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => b.textContent?.trim() === 'Save') as HTMLButtonElement;
    saveBtn.click();

    expect(updateNickname).toHaveBeenCalledWith('Nick');
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('surfaces save error when updateNickname fails', () => {
    updateNickname.mockReturnValue(throwError(() => new Error('nope')));
    const fixture = TestBed.createComponent(HomeNavbarComponent);
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector(
      'button[aria-haspopup="dialog"]',
    ) as HTMLButtonElement;
    toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    const saveBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => b.textContent?.trim() === 'Save') as HTMLButtonElement;
    saveBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('nope');
  });
});
