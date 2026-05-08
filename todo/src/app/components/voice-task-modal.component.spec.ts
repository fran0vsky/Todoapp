import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceTaskModalComponent } from './voice-task-modal.component';
import { VoiceTaskService } from '../services/voice-task.service';
import { TaskApiService } from '../services/task-api.service';
import { TaskStateService } from '../services/task-state.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { TaskStatus } from '../models/task.model';

const taskApiStub = vi.hoisted(() => ({
  getTasks: vi.fn(() => of([])),
  getAssignableUsers: vi.fn(() => of([])),
  getArchivedTasks: vi.fn(() => of([])),
  createTask: vi.fn(() =>
    of({
      id: 99,
      project_id: 1,
      title: 'Voice',
      description: '',
      status: TaskStatus.Todo,
    }),
  ),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  archiveTask: vi.fn(),
  restoreTask: vi.fn(),
}));

function voiceServiceFactory() {
  const stateSig = signal<
    'idle' | 'recording' | 'processing' | 'edit' | 'preview' | 'error'
  >('recording');
  const errorMsgSig = signal('');
  return {
    state: stateSig,
    errorMessage: errorMsgSig,
    _pendingBlob: null as Blob | null,
    startRecording: vi.fn(async () => {
      stateSig.set('recording');
    }),
    cleanup: vi.fn(),
    resetCaptureOnly: vi.fn(),
    processVoiceBoard: vi.fn(),
    logVoiceData: vi.fn(),
    getAnalyserNode: () => null,
  };
}

describe('VoiceTaskModalComponent', () => {
  let voice: ReturnType<typeof voiceServiceFactory>;

  beforeEach(() => {
    voice = voiceServiceFactory();
    taskApiStub.getTasks.mockImplementation(() => of([]));
    taskApiStub.getAssignableUsers.mockImplementation(() => of([]));
    voice.startRecording.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [VoiceTaskModalComponent],
      providers: [
        TaskStateService,
        { provide: TaskApiService, useValue: taskApiStub },
        {
          provide: VoiceTaskService,
          useValue: voice,
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ email: 'me@test.com' }),
          },
        },
        { provide: ToastService, useValue: { show: vi.fn() } },
      ],
    });
    const ts = TestBed.inject(TaskStateService);
    ts.setActiveProject(1, 'P');
    ts.loadTasks();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('emits closed when Close is clicked', () => {
    const fixture = TestBed.createComponent(VoiceTaskModalComponent);
    const closedSpy = vi.spyOn(fixture.componentInstance.closed, 'emit');
    fixture.detectChanges();
    const closeBtn = fixture.nativeElement.querySelector(
      'button[aria-label="Close"]',
    ) as HTMLButtonElement;
    closeBtn.click();
    expect(closedSpy).toHaveBeenCalled();
    fixture.destroy();
    expect(voice.cleanup).toHaveBeenCalled();
  });

  it('createTask calls API and emits created', () => {
    voice.state.set('edit');
    const fixture = TestBed.createComponent(VoiceTaskModalComponent);
    const createdSpy = vi.spyOn(fixture.componentInstance.created, 'emit');
    const cmp = fixture.componentInstance as unknown as {
      parsedTitle: ReturnType<typeof signal>;
      parsedDescription: ReturnType<typeof signal>;
      parsedStatus: ReturnType<typeof signal>;
      parsedEstimate: ReturnType<typeof signal>;
      createTask(): void;
    };
    cmp.parsedTitle.set('Hello');
    cmp.parsedDescription.set('D');
    cmp.parsedStatus.set(TaskStatus.Todo);
    cmp.parsedEstimate.set(null);
    fixture.detectChanges();
    cmp.createTask();
    expect(taskApiStub.createTask).toHaveBeenCalled();
    expect(createdSpy).toHaveBeenCalled();
  });
});
