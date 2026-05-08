import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskStatus } from '../models/task.model';
import { API_BASE_URL } from '../shared/api-base';
import { VoiceTaskService } from './voice-task.service';

describe('VoiceTaskService', () => {
  let svc!: VoiceTaskService;
  let httpMock!: HttpTestingController;

  function setup(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        VoiceTaskService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    svc = TestBed.inject(VoiceTaskService);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    try {
      httpMock.verify();
    } catch {
      /* reset between tests without shared mock */
    }
    TestBed.resetTestingModule();
  });

  const blob = new Blob(['']);

  it('processAudio resolves JSON', async () => {
    setup();
    const p = svc.processAudio(blob);
    httpMock.expectOne(`${API_BASE_URL}/api/voice/process`).flush({
      transcript: 't',
      title: 'T',
      status: TaskStatus.Todo,
      estimate: null,
      description: '',
    });
    expect((await p).title).toBe('T');
  });

  it('processAudio maps API error strings', async () => {
    setup();
    const p = svc.processAudio(blob);
    httpMock
      .expectOne(`${API_BASE_URL}/api/voice/process`)
      .flush({ error: 'boom' }, { status: 500, statusText: 'x' });
    await expect(p).rejects.toThrow(/boom/);
  });

  it('processVoiceBoard handles kinds', async () => {
    const cases: Record<string, Record<string, unknown>> = {
      filter: { kind: 'filter_tasks', transcript: 't' },
      unclear: { kind: 'unclear', transcript: 'u', clarification_hint: '?' },
      assign: { kind: 'assign_task', transcript: 'a', task: 'x' },
      move: {
        kind: 'move_task',
        transcript: 'm',
        task: 'z',
        status: TaskStatus.Done,
      },
      createInvalid: {
        kind: 'create_task',
        transcript: '',
        title: '',
        description: '',
        status: TaskStatus.Done,
        estimate: 'x',
      },
    };
    for (const [, body] of Object.entries(cases)) {
      setup();
      const p = svc.processVoiceBoard(blob);
      httpMock.expectOne(`${API_BASE_URL}/api/voice/board`).flush(body);
      await p;
    }
  });

  it('throws on unknown board kind', async () => {
    setup();
    const p = svc.processVoiceBoard(blob);
    httpMock
      .expectOne(`${API_BASE_URL}/api/voice/board`)
      .flush({ kind: 'weird', transcript: '' });
    await expect(p).rejects.toThrow(/Unexpected voice board/i);
  });

  it('processVoiceBoard maps status 0', async () => {
    setup();
    const p = svc.processVoiceBoard(blob);
    httpMock
      .expectOne(`${API_BASE_URL}/api/voice/board`)
      .error(new ProgressEvent('err'));
    await expect(p).rejects.toThrow(/Cannot reach the API/);
  });

  it('logVoiceData tolerates http errors', () => {
    setup();
    svc.logVoiceData({
      task: 'one',
      expected: {
        title: '',
        description: '',
        status: TaskStatus.Todo,
        estimate: null,
      },
    });
    httpMock
      .expectOne(`${API_BASE_URL}/api/voice/log`)
      .flush(null, { status: 500, statusText: 'Server Error' });
  });

  it('cleanup resets idle state', () => {
    setup();
    svc.cleanup();
    expect(svc.state()).toBe('idle');
  });

  it('getAnalyserNode returns null initially', () => {
    setup();
    expect(svc.getAnalyserNode()).toBeNull();
  });
});
