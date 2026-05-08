import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddEditTaskComponent } from './add-edit-task.component';
import { SpeechRecognitionService } from '../services/speech-recognition.service';
import { TaskStatus } from '../models/task.model';

describe('AddEditTaskComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AddEditTaskComponent],
      providers: [
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
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('emits titleChange when title input changes', () => {
    const fixture = TestBed.createComponent(AddEditTaskComponent);
    fixture.componentInstance.title = 'A';
    fixture.detectChanges();
    const spy = vi.spyOn(fixture.componentInstance.titleChange, 'emit');
    const input = fixture.nativeElement.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement;
    input.value = 'New title';
    input.dispatchEvent(new Event('input'));
    expect(spy).toHaveBeenCalledWith('New title');
  });

  it('emits taskStatusChange when status select changes', () => {
    const fixture = TestBed.createComponent(AddEditTaskComponent);
    fixture.componentInstance.status = TaskStatus.Todo;
    fixture.detectChanges();
    const spy = vi.spyOn(fixture.componentInstance.taskStatusChange, 'emit');
    const select = fixture.nativeElement.querySelector(
      'select[aria-label="Task status"]',
    ) as HTMLSelectElement;
    select.value = 'done';
    select.dispatchEvent(new Event('change'));
    expect(spy).toHaveBeenCalledWith(TaskStatus.Done);
  });

  it('does not emit submitForm when disableSubmit is true', () => {
    const fixture = TestBed.createComponent(AddEditTaskComponent);
    fixture.componentInstance.disableSubmit = true;
    fixture.detectChanges();
    const spy = vi.spyOn(fixture.componentInstance.submitForm, 'emit');
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    expect(spy).not.toHaveBeenCalled();
  });
});
