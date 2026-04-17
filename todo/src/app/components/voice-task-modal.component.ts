import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaskApiService } from '../services/task-api.service';
import { TaskStateService } from '../services/task-state.service';
import { VoiceTaskService, VoiceProcessResult } from '../services/voice-task.service';
import { FIBONACCI_ESTIMATES, TaskStatus } from '../models/task.model';
import { Task } from '../models/task.model';

@Component({
  selector: 'app-voice-task-modal',
  imports: [FormsModule],
  templateUrl: './voice-task-modal.component.html',
})
export class VoiceTaskModalComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly voiceService = inject(VoiceTaskService);
  private readonly taskApi = inject(TaskApiService);
  protected readonly taskState = inject(TaskStateService);

  readonly created = output<Task>();
  readonly closed = output<void>();

  @ViewChild('waveCanvas') private waveCanvas?: ElementRef<HTMLCanvasElement>;

  protected readonly TaskStatus = TaskStatus;
  protected readonly fibonacciEstimates = FIBONACCI_ESTIMATES;

  protected readonly voiceState = computed(() => this.voiceService.state());
  protected readonly errorMessage = computed(() => this.voiceService.errorMessage());

  protected readonly transcript = signal('');
  protected readonly parsedTitle = signal('');
  protected readonly parsedStatus = signal<TaskStatus>(TaskStatus.Todo);
  protected readonly parsedEstimate = signal<number | null>(null);
  protected readonly parsedDescription = signal('');

  protected readonly submitting = signal(false);
  protected readonly submitError = signal('');

  private animFrameId: number | null = null;

  constructor() {
    // Watch for auto-silence stop: service sets state to 'processing' and _pendingBlob
    effect(() => {
      if (this.voiceState() === 'processing') {
        const blob = this.voiceService._pendingBlob;
        if (blob) {
          this.voiceService._pendingBlob = null;
          this.runProcessing(blob);
        }
      }
    });
  }

  ngOnInit(): void {
    this.voiceService.startRecording();
  }

  ngAfterViewInit(): void {
    this.drawWaveform();
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    this.voiceService.cleanup();
  }

  protected close(): void {
    this.closed.emit();
  }

  protected async retry(): Promise<void> {
    this.voiceService.resetCaptureOnly();
    this.voiceService.errorMessage.set('');
    this.voiceService.state.set('idle');
    this.transcript.set('');
    this.parsedTitle.set('');
    this.parsedStatus.set(TaskStatus.Todo);
    this.parsedEstimate.set(null);
    this.parsedDescription.set('');
    this.submitError.set('');
    await this.voiceService.startRecording();
  }

  protected createTask(): void {
    const projectId = this.taskState.activeProjectId();
    if (!projectId || !this.parsedTitle().trim()) return;

    this.submitting.set(true);
    this.submitError.set('');

    this.taskApi
      .createTask({
        project_id: projectId,
        title: this.parsedTitle().trim(),
        description: this.parsedDescription(),
        status: this.parsedStatus(),
        estimate: this.parsedEstimate(),
      })
      .subscribe({
        next: (task) => {
          this.taskState.addTaskLocally(task);
          this.submitting.set(false);
          this.created.emit(task);
          this.closed.emit();
        },
        error: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Failed to create task';
          this.submitError.set(msg);
          this.submitting.set(false);
        },
      });
  }

  private async runProcessing(blob: Blob): Promise<void> {
    try {
      const result: VoiceProcessResult = await this.voiceService.processAudio(blob);
      this.transcript.set(result.transcript);
      this.parsedTitle.set(result.title);
      this.parsedStatus.set(result.status);
      this.parsedEstimate.set(result.estimate);
      this.parsedDescription.set(result.description);
      this.voiceService.state.set('preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process voice';
      this.voiceService.errorMessage.set(msg);
      this.voiceService.state.set('error');
    }
  }

  private drawWaveform(): void {
    const canvas = this.waveCanvas?.nativeElement;
    if (!canvas) {
      this.animFrameId = requestAnimationFrame(() => this.drawWaveform());
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = this.voiceService.getAnalyserNode();
    if (!analyser || this.voiceState() !== 'recording') {
      this.animFrameId = requestAnimationFrame(() => this.drawWaveform());
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (this.voiceState() !== 'recording') return;

      analyser.getByteFrequencyData(dataArray);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barCount = 48;
      const step = Math.floor(bufferLength / barCount);
      const barW = Math.max(2, Math.floor(w / barCount) - 2);
      const gap = Math.floor((w - barCount * barW) / (barCount + 1));

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] ?? 0;
        const barH = Math.max(3, (value / 255) * h * 0.85);
        const x = gap + i * (barW + gap);
        const y = (h - barH) / 2;

        const alpha = 0.5 + (value / 255) * 0.5;
        ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, barW / 2);
        ctx.fill();
      }

      this.animFrameId = requestAnimationFrame(draw);
    };

    this.animFrameId = requestAnimationFrame(draw);
  }
}
