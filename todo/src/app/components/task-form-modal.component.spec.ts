import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskFormModalComponent } from './task-form-modal.component';
import { TaskStateService } from '../services/task-state.service';
import { TaskApiService } from '../services/task-api.service';
import { SpeechRecognitionService } from '../services/speech-recognition.service';

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

describe('TaskFormModalComponent', () => {
  beforeEach(() => {
    taskApiStub.getTasks.mockImplementation(() => of([]));
    taskApiStub.getAssignableUsers.mockImplementation(() => of([]));
    TestBed.configureTestingModule({
      imports: [TaskFormModalComponent],
      providers: [
        TaskStateService,
        { provide: TaskApiService, useValue: taskApiStub },
        {
          provide: SpeechRecognitionService,
          useValue: {
            state: signal('idle' as const).asReadonly(),
            cancel: vi.fn(),
            start: vi.fn().mockResolvedValue(undefined),
            stopAndTranscribe: vi.fn().mockResolvedValue(''),
            clearError: vi.fn(),
            error: signal(null).asReadonly(),
            modelProgress: signal(null).asReadonly(),
            isBusy: () => false,
          },
        },
      ],
    });
    const ts = TestBed.inject(TaskStateService);
    ts.setActiveProject(1, 'P');
    ts.loadTasks();
    ts.openAddForm();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders modal title from task state and closes on close button', () => {
    const fixture = TestBed.createComponent(TaskFormModalComponent);
    const ts = TestBed.inject(TaskStateService);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Add task');
    const closeSpy = vi.spyOn(ts, 'closeFormModal');
    const closeBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Close"]',
    ) as HTMLButtonElement;
    closeBtn.click();
    expect(closeSpy).toHaveBeenCalled();
  });
});
