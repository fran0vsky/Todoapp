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
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../services/task-api.service';
import { TaskStateService } from '../services/task-state.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { VoiceTaskService } from '../services/voice-task.service';
import { FIBONACCI_ESTIMATES, TaskStatus } from '../models/task.model';
import { Task } from '../models/task.model';
import { resolveTaskByTitle } from '../shared/voice-task-resolve';

@Component({
  selector: 'app-voice-task-modal',
  imports: [FormsModule],
  // File name versioned so dev-server cache reliably picks up direct-edit UI.
  templateUrl: './voice-task-modal.direct-edit.html',
})
export class VoiceTaskModalComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  private readonly voiceService = inject(VoiceTaskService);
  private readonly taskApi = inject(TaskApiService);
  protected readonly taskState = inject(TaskStateService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly created = output<Task>();
  readonly closed = output<void>();

  @ViewChild('waveCanvas') private waveCanvas?: ElementRef<HTMLCanvasElement>;

  protected readonly TaskStatus = TaskStatus;
  protected readonly fibonacciEstimates = FIBONACCI_ESTIMATES;

  protected readonly voiceState = computed(() => this.voiceService.state());
  protected readonly errorMessage = computed(() =>
    this.voiceService.errorMessage(),
  );

  /** Direct-edit form: `edit`, or legacy `preview` from cached bundles (same screen). */
  protected readonly showVoiceEditForm = computed(() => {
    const s = this.voiceService.state();
    return s === 'edit' || s === 'preview';
  });

  protected readonly transcript = signal('');
  protected readonly parsedTitle = signal('');
  protected readonly parsedStatus = signal<TaskStatus>(TaskStatus.Todo);
  protected readonly parsedEstimate = signal<number | null>(null);
  protected readonly parsedDescription = signal('');

  protected readonly submitting = signal(false);
  protected readonly submitError = signal('');

  /** Shown when AI chose Doing but the board already has a WIP task (one-task limit). */
  protected readonly wipLimitHint = signal<string | null>(null);

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

    // Normalize legacy `preview` → `edit` (e.g. mixed cached chunks).
    effect(() => {
      if (this.voiceService.state() === 'preview') {
        this.voiceService.state.set('edit');
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
    this.wipLimitHint.set(null);
    await this.voiceService.startRecording();
  }

  protected createTask(): void {
    const projectId = this.taskState.activeProjectId();
    if (!projectId || !this.parsedTitle().trim()) return;

    if (
      this.parsedStatus() === TaskStatus.Doing &&
      this.taskState.workInProgressFull()
    ) {
      this.submitError.set(
        'Work in progress is full — only one task allowed there. Change status or free the column first.',
      );
      return;
    }

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
          const msg =
            err instanceof Error ? err.message : 'Failed to create task';
          this.submitError.set(msg);
          this.submitting.set(false);
        },
      });
  }

  private async runProcessing(blob: Blob): Promise<void> {
    try {
      const board = await this.voiceService.processVoiceBoard(blob);

      if (board.kind === 'unclear') {
        const hint = board.clarification_hint?.trim();
        this.toast.show(
          hint ||
            'Say a command (e.g. filter my tasks) or describe a new task.',
          'error',
        );
        this.voiceService.state.set('idle');
        this.closed.emit();
        return;
      }

      if (board.kind === 'filter_tasks') {
        const email = this.auth.currentUser()?.email?.trim();
        if (!email) {
          this.toast.show('Sign in to filter your tasks.', 'error');
          this.voiceService.state.set('idle');
          this.closed.emit();
          return;
        }
        this.taskState.setAssigneeFilterFromSelect(email);
        this.toast.show('Showing your tasks');
        this.voiceService.state.set('idle');
        this.closed.emit();
        return;
      }

      if (board.kind === 'assign_task') {
        const email = this.auth.currentUser()?.email?.trim();
        if (!email) {
          this.toast.show('Sign in to assign tasks.', 'error');
          this.voiceService.state.set('idle');
          this.closed.emit();
          return;
        }
        const resolved = resolveTaskByTitle(this.taskState.tasks(), board.task);
        if (!resolved.ok) {
          if (resolved.reason === 'ambiguous') {
            const names = resolved.candidates
              .slice(0, 3)
              .map((t) => `"${t.title}"`)
              .join(', ');
            this.toast.show(
              `Which task? Try again with the full title. Matches: ${names}`,
              'error',
            );
          } else {
            this.toast.show(`No task matches "${board.task}".`, 'error');
          }
          this.voiceService.state.set('idle');
          this.closed.emit();
          return;
        }
        try {
          const updated = await firstValueFrom(
            this.taskApi.updateTask(resolved.task.id, {
              assignee_email: email,
            }),
          );
          this.taskState.applyRemoteTaskUpdate(updated);
          this.toast.show(`Assigned "${updated.title}" to you`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Could not assign task';
          this.toast.show(msg, 'error');
        }
        this.voiceService.state.set('idle');
        this.closed.emit();
        return;
      }

      if (board.kind === 'move_task') {
        const resolved = resolveTaskByTitle(this.taskState.tasks(), board.task);
        if (!resolved.ok) {
          if (resolved.reason === 'ambiguous') {
            const names = resolved.candidates
              .slice(0, 3)
              .map((t) => `"${t.title}"`)
              .join(', ');
            this.toast.show(
              `Which task? Try again with the full title. Matches: ${names}`,
              'error',
            );
          } else {
            this.toast.show(`No task matches "${board.task}".`, 'error');
          }
          this.voiceService.state.set('idle');
          this.closed.emit();
          return;
        }
        const task = resolved.task;
        const newStatus = board.status;
        if (
          newStatus === TaskStatus.Doing &&
          this.taskState.workInProgressFull() &&
          task.status !== TaskStatus.Doing
        ) {
          this.toast.show(
            'Work in progress is full — finish or move the current task there first.',
            'error',
          );
          this.voiceService.state.set('idle');
          this.closed.emit();
          return;
        }
        try {
          const updated = await firstValueFrom(
            this.taskApi.updateTask(task.id, { status: newStatus }),
          );
          this.taskState.applyRemoteTaskUpdate(updated);
          this.toast.show(`Moved "${updated.title}"`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Could not move task';
          this.toast.show(msg, 'error');
        }
        this.voiceService.state.set('idle');
        this.closed.emit();
        return;
      }

      // create_task — same review step as before
      const result = board;
      this.transcript.set(result.transcript);
      this.parsedTitle.set(result.title);
      this.wipLimitHint.set(null);

      let status = VoiceTaskModalComponent.parseStatus(result.status);
      if (status === TaskStatus.Doing && this.taskState.workInProgressFull()) {
        status = TaskStatus.Todo;
        this.wipLimitHint.set(
          'AI suggested Work in progress, but that column already has a task. This draft is set to To do — confirm or edit.',
        );
      }
      this.parsedStatus.set(status);
      this.parsedEstimate.set(
        VoiceTaskModalComponent.parseEstimate(result.estimate),
      );
      this.parsedDescription.set(result.description);
      this.voiceService.logVoiceData({
        task: result.transcript,
        expected: {
          title: result.title.trim(),
          description: result.description,
          status,
          estimate: result.estimate,
        },
      });
      this.voiceService.state.set('edit');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to process voice';
      this.voiceService.errorMessage.set(msg);
      this.voiceService.state.set('error');
    }
  }

  private static parseStatus(raw: unknown): TaskStatus {
    const s = typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
    if (s === TaskStatus.Todo || s === 'todo') return TaskStatus.Todo;
    if (s === TaskStatus.Doing || s === 'doing') return TaskStatus.Doing;
    if (s === TaskStatus.Done || s === 'done') return TaskStatus.Done;
    return TaskStatus.Todo;
  }

  private static parseEstimate(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === '') return null;
    const n =
      typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
    if (!Number.isInteger(n) || ![1, 2, 3, 5, 8].includes(n)) return null;
    return n;
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
      const step = Math.max(1, Math.floor(bufferLength / barCount));
      const barW = Math.max(2, Math.floor(w / barCount) - 2);
      const gap = Math.floor((w - barCount * barW) / (barCount + 1));
      const totalBarStrip = barCount * barW + (barCount + 1) * gap;
      const startX = (w - totalBarStrip) / 2;
      const center = (barCount - 1) / 2;
      const maxDist = Math.max(center, 1e-6);

      for (let i = 0; i < barCount; i++) {
        const mirrored = Math.min(i, barCount - 1 - i);
        const bin = Math.min(bufferLength - 1, mirrored * step);
        const value = dataArray[bin] ?? 0;
        const dist = Math.abs(i - center);
        const envelope = Math.cos((dist / maxDist) * (Math.PI / 2)) ** 2;
        const barH = Math.max(3, (value / 255) * h * 0.85 * envelope);
        const x = startX + gap + i * (barW + gap);
        const y = (h - barH) / 2;

        const alpha = 0.5 + (value / 255) * envelope * 0.5;
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
