import { Injectable, signal } from '@angular/core';

/** Sample rate Whisper expects. All audio is resampled to this before inference. */
const WHISPER_SAMPLE_RATE = 16_000;

/**
 * Whisper model loaded on first use.
 *
 * Using the Xenova fork with both sessions pinned to `fp32`. The lower-bit variants
 * (`q4`, `q4f16`, and even `q8` on `onnx-community/whisper-tiny.en`) contain int4-packed
 * weights for `model.decoder.embed_tokens`. When onnxruntime-web's graph optimizer tries to
 * fuse the matching `DequantizeLinear + MatMul` pair into a `MatMulNBits` op, it fails with:
 *   "qdq_actions.cc:137 TransposeDQWeightsForMatMulNBits Missing required scale: … weight_merged_0_scale"
 * `fp32` carries no quantized ops, so that code path never runs.
 *
 * Size: ~31 MB encoder + ~150 MB decoder, fetched once and cached in IndexedDB per-origin.
 */
const WHISPER_MODEL = 'Xenova/whisper-tiny.en';

const WHISPER_DTYPE = {
  encoder_model: 'fp32',
  decoder_model_merged: 'fp32',
} as const;

/** Cap a single dictation at 60 s to avoid runaway recordings and OOM during inference. */
const MAX_RECORDING_MS = 60_000;

export type RecorderState =
  | 'idle'
  | 'requesting-permission'
  | 'loading-model'
  | 'recording'
  | 'processing'
  | 'error';

/** Lazy handle to the Whisper pipeline; kept at module scope so repeated use doesn't re-download. */
type WhisperPipeline = (input: Float32Array, options?: Record<string, unknown>) => Promise<{ text: string } | Array<{ text: string }>>;
let whisperPipeline: WhisperPipeline | null = null;
let whisperLoader: Promise<WhisperPipeline> | null = null;

@Injectable({ providedIn: 'root' })
export class SpeechRecognitionService {
  private readonly stateSig = signal<RecorderState>('idle');
  private readonly errorSig = signal<string | null>(null);
  /** 0–100 while the Whisper weights stream in on first use; null otherwise. */
  private readonly modelProgressSig = signal<number | null>(null);

  readonly state = this.stateSig.asReadonly();
  readonly error = this.errorSig.asReadonly();
  readonly modelProgress = this.modelProgressSig.asReadonly();

  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private autoStopTimer: ReturnType<typeof setTimeout> | null = null;

  /** True while a dictation is actively capturing or transcribing (UI disables the mic for new starts). */
  isBusy(): boolean {
    const s = this.stateSig();
    return s === 'requesting-permission' || s === 'loading-model' || s === 'recording' || s === 'processing';
  }

  /**
   * Start recording microphone audio. Resolves once the MediaRecorder is running.
   * Pre-warms the Whisper pipeline in the background so stop-to-text is fast.
   */
  async start(): Promise<void> {
    if (this.isBusy()) return;
    this.errorSig.set(null);
    this.stateSig.set('requesting-permission');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      this.failWithError(this.describePermissionError(err));
      return;
    }

    // Kick off model download in parallel with the user speaking.
    void this.ensurePipeline();

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      this.failWithError('Your browser does not support audio recording.');
      return;
    }

    this.mediaStream = stream;
    this.mediaRecorder = recorder;
    this.chunks = [];

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    });

    this.stateSig.set('recording');
    recorder.start();

    this.autoStopTimer = setTimeout(() => {
      if (this.stateSig() === 'recording') {
        void this.stopAndTranscribe();
      }
    }, MAX_RECORDING_MS);
  }

  /**
   * Stop the current recording and transcribe it. Returns the transcript (may be empty string
   * if nothing was recognised) or `null` when recording wasn't active or an error occurred.
   */
  async stopAndTranscribe(): Promise<string | null> {
    const recorder = this.mediaRecorder;
    if (!recorder || this.stateSig() !== 'recording') return null;

    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }

    // MediaRecorder.stop() flushes remaining data via `dataavailable` then fires `stop`.
    const stopped = new Promise<void>((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true });
    });
    recorder.stop();
    await stopped;

    this.releaseStream();

    const mimeType = recorder.mimeType || 'audio/webm';
    const blob = new Blob(this.chunks, { type: mimeType });
    this.chunks = [];

    if (blob.size === 0) {
      this.failWithError('No audio was captured. Check your microphone and try again.');
      return null;
    }

    this.stateSig.set('processing');
    try {
      const samples = await this.decodeToMono16k(blob);
      if (!samples || !samples.length) {
        this.failWithError('No speech detected — try speaking closer to the microphone.');
        return null;
      }

      const pipeline = await this.ensurePipeline();
      // whisper-tiny.en is English-only; passing `language` or `task` throws
      // "Cannot specify `task` or `language` for an English-only model".
      const result = await pipeline(samples);
      const text = Array.isArray(result) ? result[0]?.text ?? '' : result?.text ?? '';
      const trimmed = text.trim();

      if (!trimmed) {
        this.failWithError('No speech detected — try again.');
        return null;
      }

      this.stateSig.set('idle');
      return trimmed;
    } catch (err) {
      this.failWithError(
        err instanceof Error && err.message
          ? `Transcription failed: ${err.message}`
          : 'Transcription failed. Please try again.'
      );
      return null;
    }
  }

  /** Abort an in-flight recording without running transcription. */
  cancel(): void {
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore — best-effort teardown
      }
    }
    this.mediaRecorder = null;
    this.chunks = [];
    this.releaseStream();
    this.stateSig.set('idle');
    this.errorSig.set(null);
  }

  /** Clear the current error banner without touching recorder state. */
  clearError(): void {
    this.errorSig.set(null);
    if (this.stateSig() === 'error') this.stateSig.set('idle');
  }

  // ---------- internals ----------

  private failWithError(message: string): void {
    this.releaseStream();
    this.chunks = [];
    this.mediaRecorder = null;
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }
    this.errorSig.set(message);
    this.stateSig.set('error');
  }

  private releaseStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  private describePermissionError(err: unknown): string {
    if (err instanceof DOMException) {
      switch (err.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          return 'Microphone access denied. Allow it in your browser settings to dictate.';
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          return 'No microphone was found on this device.';
        case 'NotReadableError':
          return 'The microphone is already in use by another application.';
        default:
          return err.message || 'Could not access the microphone.';
      }
    }
    return 'Could not access the microphone.';
  }

  /**
   * Decode an encoded audio Blob (webm/ogg/mp4 — whatever the browser's MediaRecorder produced)
   * into a mono Float32 buffer at 16 kHz using OfflineAudioContext for resampling.
   */
  private async decodeToMono16k(blob: Blob): Promise<Float32Array | null> {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioCtx) {
      throw new Error('Web Audio API is not available in this browser.');
    }
    const ctx = new AudioCtx();
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      await ctx.close().catch(() => undefined);
    }

    if (buffer.sampleRate === WHISPER_SAMPLE_RATE && buffer.numberOfChannels === 1) {
      return buffer.getChannelData(0).slice();
    }

    const targetFrames = Math.ceil(buffer.duration * WHISPER_SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, targetFrames, WHISPER_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0).slice();
  }

  /** Lazy-load and cache the Whisper pipeline. Concurrent callers share the same loader promise. */
  private ensurePipeline(): Promise<WhisperPipeline> {
    if (whisperPipeline) return Promise.resolve(whisperPipeline);
    if (whisperLoader) return whisperLoader;

    const previousState = this.stateSig();
    if (previousState !== 'recording') this.stateSig.set('loading-model');

    whisperLoader = (async () => {
      // Dynamic import keeps the large transformers bundle out of the initial app chunk.
      const mod = await import('@huggingface/transformers');
      const pipe = (await mod.pipeline('automatic-speech-recognition', WHISPER_MODEL, {
        dtype: WHISPER_DTYPE,
        device: 'wasm',
        // Defensive: skip the `extended` graph-optimization pass that attempts DQ→MatMulNBits
        // fusion. That pass blows up on the mixed-quant Whisper decoders in some model exports.
        session_options: { graphOptimizationLevel: 'basic' },
        progress_callback: (evt: { status?: string; progress?: number }) => {
          if (evt?.status === 'progress' && typeof evt.progress === 'number') {
            this.modelProgressSig.set(Math.round(evt.progress));
          }
          if (evt?.status === 'done' || evt?.status === 'ready') {
            this.modelProgressSig.set(null);
          }
        },
      })) as unknown as WhisperPipeline;
      whisperPipeline = pipe;
      this.modelProgressSig.set(null);
      return pipe;
    })();

    whisperLoader.catch(() => {
      // Let the next call retry; failure is surfaced by stopAndTranscribe().
      whisperLoader = null;
    });

    return whisperLoader;
  }
}
