import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../shared/api-base';
import { TaskStatus } from '../models/task.model';

export interface VoiceProcessResult {
  transcript: string;
  title: string;
  status: TaskStatus;
  estimate: number | null;
  description: string;
}

export interface VoiceLogPayload {
  task: string;
  expected: {
    title: string;
    description: string;
    status: TaskStatus;
    estimate: number | null;
  };
}

/** `preview` is deprecated — same UI as `edit`; kept so old bundles / state still show the form. */
export type VoiceRecordingState =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'edit'
  | 'preview'
  | 'error';

@Injectable({ providedIn: 'root' })
export class VoiceTaskService {
  private readonly http = inject(HttpClient);
  private readonly voiceUrl = `${API_BASE_URL}/api/voice/process`;
  private readonly voiceLogUrl = `${API_BASE_URL}/api/voice/log`;

  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private chunks: Blob[] = [];
  private onStopCallback: ((blob: Blob) => void) | null = null;

  /** When recording began (for grace period before silence can auto-stop). */
  private recordingStartedAt = 0;
  /** True after we detect voice-level audio — avoids stopping while user has not started talking. */
  private hasHeardSpeech = false;

  /** Silence detection thresholds. */
  private readonly SILENCE_THRESHOLD = 0.01;
  /** How long quiet must last after speech before auto-stop. */
  private readonly SILENCE_DURATION_MS = 2200;
  /** Ignore silence-based auto-stop for this long after mic opens (time to start speaking). */
  private readonly INITIAL_GRACE_MS = 5000;
  /** Hard cap so the recorder cannot run forever if the user never speaks. */
  private readonly MAX_RECORDING_MS = 120_000;

  readonly state = signal<VoiceRecordingState>('idle');
  readonly errorMessage = signal<string>('');

  /** Expose the analyser node for waveform drawing in the modal. */
  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  async startRecording(): Promise<void> {
    try {
      this.teardownCapture();
      this._pendingBlob = null;
      this.chunks = [];
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.audioContext = new AudioContext();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;
      source.connect(this.analyserNode);

      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mimeType || 'audio/webm' });
        this.onStopCallback?.(blob);
        this.onStopCallback = null;
      };

      this.mediaRecorder.start(100);
      this.recordingStartedAt = Date.now();
      this.hasHeardSpeech = false;
      this.state.set('recording');
      this.startSilenceDetection();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message.includes('Permission')
            ? 'Microphone permission denied. Please allow access and try again.'
            : err.message
          : 'Could not access microphone';
      this.errorMessage.set(msg);
      this.state.set('error');
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      this.stopSilenceDetection();

      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        this.mediaRecorder = null;
        this.closeAudioGraph();
        resolve(blob);
        return;
      }

      this.onStopCallback = (blob) => {
        this.mediaRecorder = null;
        this.closeAudioGraph();
        resolve(blob);
      };
      this.mediaRecorder.stop();
      this.releaseStream();
    });
  }

  async processAudio(blob: Blob): Promise<VoiceProcessResult> {
    this.state.set('processing');

    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    try {
      const result = await firstValueFrom(
        this.http.post<VoiceProcessResult>(this.voiceUrl, formData)
      );
      return result;
    } catch (err: unknown) {
      throw new Error(this.httpErrorToMessage(err));
    }
  }

  /** Appends one JSONL line when `VOICE_DATA_LOG_PATH` is set on the API (otherwise server no-ops). */
  logVoiceData(payload: VoiceLogPayload): void {
    this.http.post(this.voiceLogUrl, payload).subscribe({ error: () => undefined });
  }

  cleanup(): void {
    this.stopSilenceDetection();
    this.teardownCapture();
    this._pendingBlob = null;
    this.chunks = [];
    this.state.set('idle');
  }

  /** Release mic + audio graph without resetting `state` (e.g. before retry while modal stays open). */
  resetCaptureOnly(): void {
    this.stopSilenceDetection();
    this.teardownCapture();
    this._pendingBlob = null;
    this.chunks = [];
  }

  private httpErrorToMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object' && 'error' in body) {
        const e = (body as { error: unknown }).error;
        if (typeof e === 'string' && e.trim()) return e;
      }
      if (typeof err.error === 'string' && err.error.trim()) return err.error;
      if (err.status === 0) {
        return 'Cannot reach the API. Is the server running (nx serve api)?';
      }
      return err.message || `Request failed (${err.status})`;
    }
    if (err instanceof Error) return err.message;
    return 'Failed to process voice recording';
  }

  private teardownCapture(): void {
    this.stopSilenceDetection();
    this.onStopCallback = null;
    const rec = this.mediaRecorder;
    this.mediaRecorder = null;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    }
    this.releaseStream();
    this.closeAudioGraph();
  }

  private closeAudioGraph(): void {
    this.analyserNode = null;
    const ctx = this.audioContext;
    this.audioContext = null;
    if (ctx && ctx.state !== 'closed') {
      void ctx.close();
    }
  }

  private startSilenceDetection(): void {
    if (!this.analyserNode) return;

    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let silenceStart: number | null = null;

    const detect = () => {
      if (!this.analyserNode || this.state() !== 'recording') return;

      this.analyserNode.getByteTimeDomainData(dataArray);

      let sumSquares = 0;
      for (const amplitude of dataArray) {
        const normalized = amplitude / 128 - 1;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);
      const now = Date.now();
      const elapsed = now - this.recordingStartedAt;

      if (elapsed >= this.MAX_RECORDING_MS) {
        this.onSilenceDetected();
        return;
      }

      const loudEnough = rms >= this.SILENCE_THRESHOLD;
      if (loudEnough) {
        this.hasHeardSpeech = true;
      }

      // Opening seconds: never treat quiet as "done" — user may still be gathering thoughts.
      if (elapsed < this.INITIAL_GRACE_MS) {
        silenceStart = null;
        requestAnimationFrame(detect);
        return;
      }

      // After grace: do not auto-stop on silence until we've heard speech at least once.
      if (!this.hasHeardSpeech) {
        silenceStart = null;
        requestAnimationFrame(detect);
        return;
      }

      if (!loudEnough) {
        if (silenceStart === null) silenceStart = now;
        else if (now - silenceStart >= this.SILENCE_DURATION_MS) {
          this.onSilenceDetected();
          return;
        }
      } else {
        silenceStart = null;
      }

      requestAnimationFrame(detect);
    };

    requestAnimationFrame(detect);
  }

  private onSilenceDetected(): void {
    if (this.state() !== 'recording') return;
    this.stopSilenceDetection();

    this.stopRecording().then((blob) => {
      this.state.set('processing');
      this._pendingBlob = blob;
    });
  }

  /** Blob set after auto-stop so the modal can pick it up. */
  _pendingBlob: Blob | null = null;

  private stopSilenceDetection(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private releaseStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  }
}
