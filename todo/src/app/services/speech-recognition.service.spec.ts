import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechRecognitionService } from './speech-recognition.service';

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(() =>
    Promise.resolve(async () => ({
      text: 'transcribed text',
    })),
  ),
}));

describe('SpeechRecognitionService', () => {
  const origMedia = globalThis.navigator.mediaDevices;
  const origMediaRecorder = globalThis.MediaRecorder;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SpeechRecognitionService] });
  });

  afterEach(() => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: origMedia,
      configurable: true,
    });
    globalThis.MediaRecorder = origMediaRecorder;
    TestBed.resetTestingModule();
  });

  function mockMediaOk(): void {
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream;
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(async () => stream) },
      configurable: true,
    });
    globalThis.MediaRecorder = class {
      readonly state = 'recording';
      mimeType = '';
      addEventListener = vi.fn();
      start = vi.fn();
      stop() {
        (this as unknown as { onstop: () => void }).onstop?.();
      }
    } as unknown as typeof MediaRecorder;
  }

  it('reports busy while recording', async () => {
    mockMediaOk();
    const svc = TestBed.inject(SpeechRecognitionService);
    await svc.start();
    expect(svc.isBusy()).toBe(true);
    svc.cancel();
    expect(svc.isBusy()).toBe(false);
  });

  it('maps microphone permission denial', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(() =>
          Promise.reject(
            Object.assign(new DOMException('denied', 'NotAllowedError')),
          ),
        ),
      },
      configurable: true,
    });
    const svc = TestBed.inject(SpeechRecognitionService);
    await svc.start();
    expect(svc.error()).toContain('Microphone access denied');
  });

  it('clearError clears error state', () => {
    const svc = TestBed.inject(SpeechRecognitionService);
    svc.clearError();
    expect(svc.error()).toBeNull();
  });
});
